import { parse, startOfDay, endOfDay, isValid, isBefore, isSameSecond } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { WeeklyHours, Event } from '../types';

/**
 * Converts an Event (working_hours type) to WeeklyHours format for backward compatibility
 * Converts UTC time back to the user's timezone to avoid double conversion
 */
function eventToWeeklyHours(event: Event, timezone: string): WeeklyHours {
  // The event.start and event.end are stored in UTC
  // We need to convert them back to the user's timezone to get the correct hours
  const startDateUTC = new Date(event.start);
  const endDateUTC = new Date(event.end);
  
  // Convert UTC to user's timezone
  const startDateInTz = toZonedTime(startDateUTC, timezone);
  const endDateInTz = toZonedTime(endDateUTC, timezone);
  
  // Extract hours and minutes from the timezone-converted dates
  const startHour = startDateInTz.getHours();
  const startMinute = startDateInTz.getMinutes();
  const endHour = endDateInTz.getHours();
  const endMinute = endDateInTz.getMinutes();
  
  return {
    id: event.id,
    profile_id: event.profile_id,
    day_of_week: event.day_of_week ?? 0,
    start_hour: startHour,
    start_minute: startMinute,
    end_hour: endHour,
    end_minute: endMinute,
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
}

/**
 * Gets weekly hours for a specific user
 * @param userId - User ID
 * @param timezone - Timezone to convert UTC times to (e.g., 'America/New_York')
 */
export async function getWeeklyHoursForUser(
  userId: string,
  timezone: string = 'UTC'
): Promise<WeeklyHours[]> {
  try {
    // Query from unified events table (working_hours type)
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('profile_id', userId)
      .eq('is_recurring', true)
      .eq('type', 'working_hours')
      .order('day_of_week', { ascending: true });

    if (eventsError) {
      console.error('Error fetching weekly hours:', eventsError);
      throw new Error(`Failed to fetch weekly hours: ${eventsError.message}`);
    }

    // Convert events to WeeklyHours format for backward compatibility
    // Convert UTC times back to user's timezone
    return (eventsData || []).map(event => eventToWeeklyHours(event, timezone));
  } catch (error) {
    console.error('Error in getWeeklyHoursForUser:', error);
    throw error;
  }
}

/**
 * Deletes a specific weekly hours entry (now an event)
 * @param weeklyHoursId - Event ID to delete (working_hours type)
 */
export async function deleteWeeklyHours(weeklyHoursId: string): Promise<void> {
  try {
    // Delete from unified events table
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', weeklyHoursId)
      .eq('type', 'working_hours')
      .eq('is_recurring', true);

    if (error) {
      console.error('Error deleting weekly hours:', error);
      throw new Error(`Failed to delete weekly hours: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteWeeklyHours:', error);
    throw error;
  }
}

/**
 * Gets weekly hours for all users for a specific weekday
 * @param weekday - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param timezone - Timezone to convert UTC times to (e.g., 'America/New_York')
 */
export async function getWeeklyHoursForWeekday(
  weekday: number,
  timezone: string = 'UTC'
): Promise<WeeklyHours[]> {
  try {
    if (weekday < 0 || weekday > 6) {
      throw new Error('Weekday must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Query from unified events table (working_hours type)
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('is_recurring', true)
      .eq('type', 'working_hours')
      .eq('day_of_week', weekday)
      .order('profile_id', { ascending: true });

    if (eventsError) {
      console.error('Error fetching weekly hours:', eventsError);
      throw new Error(`Failed to fetch weekly hours: ${eventsError.message}`);
    }

    // Convert events to WeeklyHours format for backward compatibility
    // Convert UTC times back to user's timezone
    return (eventsData || []).map(event => eventToWeeklyHours(event, timezone));
  } catch (error) {
    console.error('Error in getWeeklyHoursForWeekday:', error);
    throw error;
  }
}

/**
 * Gets events that overlap with a specific local date
 * @param dateISO - ISO date string (YYYY-MM-DD) in the target timezone
 * @param tz - Timezone string (e.g., 'Australia/Sydney')
 */
export async function getEventsForDate(
  dateISO: string,
  tz: string
): Promise<Event[]> {
  try {
    // Parse the date in the target timezone
    const localDate = toZonedTime(parse(dateISO, 'yyyy-MM-dd', new Date()), tz);
    const dayStart = startOfDay(localDate);
    const dayEnd = endOfDay(localDate);
    const weekday = localDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Convert to UTC for database query
    const dayStartUTC = fromZonedTime(dayStart, tz).toISOString();
    const dayEndUTC = fromZonedTime(dayEnd, tz).toISOString();

    // Query:
    // 1. One-time events that overlap with the day
    // 2. Recurring weekly schedules (working_hours) for this weekday
    const { data: oneTimeEvents, error: oneTimeError } = await supabase
      .from('events')
      .select('*')
      .eq('is_recurring', false)
      .lt('start', dayEndUTC)
      .gt('end', dayStartUTC);

    const { data: recurringEvents, error: recurringError } = await supabase
      .from('events')
      .select('*')
      .eq('is_recurring', true)
      .eq('type', 'working_hours')
      .eq('day_of_week', weekday);

    const error = oneTimeError || recurringError;
    const data = [...(oneTimeEvents || []), ...(recurringEvents || [])];

    if (error) {
      console.error('Error fetching events:', error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    // For recurring weekly schedules, we need to expand them to actual datetime events
    // for the specific date
    const expandedEvents: Event[] = [];
    const referenceDate = parse(dateISO, 'yyyy-MM-dd', new Date());
    
    (data || []).forEach((event: Event) => {
      if (event.is_recurring && event.type === 'working_hours' && event.day_of_week === weekday) {
        // Skip working_hours events - they are displayed separately as WorkingHoursShade
        // Don't include them in the events list to avoid double display
        return;
      } else {
        // Regular one-time event
        expandedEvents.push(event);
      }
    });

    return expandedEvents;
  } catch (error) {
    console.error('Error in getEventsForDate:', error);
    throw error;
  }
}

/**
 * Upserts weekly hours for a user (now saves as events)
 * @param userId - User ID
 * @param rows - Array of weekly hours to upsert
 */
export async function upsertWeeklyHours(
  userId: string,
  rows: Omit<WeeklyHours, 'id' | 'created_at' | 'updated_at'>[]
): Promise<WeeklyHours[]> {
  try {
    // Validate rows
    for (const row of rows) {
      if (row.profile_id !== userId) {
        throw new Error('All rows must belong to the same user');
      }
      if (row.day_of_week < 0 || row.day_of_week > 6) {
        throw new Error('day_of_week must be between 0 and 6');
      }
      if (
        row.start_hour < 0 ||
        row.start_hour > 23 ||
        row.start_minute < 0 ||
        row.start_minute > 59 ||
        row.end_hour < 0 ||
        row.end_hour > 23 ||
        row.end_minute < 0 ||
        row.end_minute > 59
      ) {
        throw new Error('Invalid time values');
      }
    }

    // First, delete existing working_hours events for this user
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('profile_id', userId)
      .eq('is_recurring', true)
      .eq('type', 'working_hours');

    if (deleteError) {
      console.error('Error deleting existing weekly hours:', deleteError);
      throw new Error(
        `Failed to delete existing weekly hours: ${deleteError.message}`
      );
    }

    // Insert new rows as events
    if (rows.length === 0) {
      return [];
    }

    // Convert WeeklyHours format to Event format
    // Use a reference date (2024-01-01) for the time components
    const referenceDate = new Date('2024-01-01T00:00:00Z');
    const eventsToCreate = rows.map((row) => {
      const startDateTime = new Date(referenceDate);
      startDateTime.setUTCHours(row.start_hour, row.start_minute, 0, 0);
      const endDateTime = new Date(referenceDate);
      endDateTime.setUTCHours(row.end_hour, row.end_minute, 0, 0);

      return {
        profile_id: row.profile_id,
        title: 'Working Hours',
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        type: 'working_hours' as const,
        is_recurring: true,
        day_of_week: row.day_of_week,
        recurrence_pattern: [row.day_of_week],
      };
    });

    // Create all events
    const createdEvents: Event[] = [];
    for (const eventData of eventsToCreate) {
      const event = await createEvent(eventData);
      createdEvents.push(event);
    }

    // Convert back to WeeklyHours format for backward compatibility
    // Note: For upsertWeeklyHours, we use UTC since we don't have timezone context
    // The hours are stored as UTC in the reference date, so we extract UTC hours
    return createdEvents.map(event => eventToWeeklyHours(event, 'UTC'));
  } catch (error) {
    console.error('Error in upsertWeeklyHours:', error);
    throw error;
  }
}

/**
 * Creates a new event
 * @param payload - Event data (without id, created_at, updated_at)
 * @param createdBy - User ID of the creator (optional)
 */
export async function createEvent(
  payload: Omit<Event, 'id' | 'created_at' | 'updated_at'>,
  createdBy?: string
): Promise<Event> {
  try {
    // Validate payload
    if (!payload.profile_id || !payload.title || !payload.start || !payload.end) {
      throw new Error('Missing required fields: profile_id, title, start, end');
    }

    if (!['meeting', 'personal', 'leave', 'working_hours'].includes(payload.type)) {
      throw new Error('Invalid event type. Must be: meeting, personal, leave, or working_hours');
    }

    // Validate dates
    const startDate = new Date(payload.start);
    const endDate = new Date(payload.end);

    if (!isValid(startDate) || !isValid(endDate)) {
      throw new Error('Invalid date format. Use ISO 8601 format.');
    }

    if (isBefore(endDate, startDate) || isSameSecond(endDate, startDate)) {
      throw new Error('End date must be after start date');
    }

    const insertData: any = { ...payload };
    if (createdBy) {
      insertData.created_by = createdBy;
    }

    const { data, error } = await supabase
      .from('events')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      throw new Error(`Failed to create event: ${error.message}`);
    }

    if (!data) {
      throw new Error('Event creation returned no data');
    }

    return data;
  } catch (error) {
    console.error('Error in createEvent:', error);
    throw error;
  }
}

/**
 * Updates an existing event
 * @param eventId - Event ID
 * @param payload - Updated event data (partial)
 */
export async function updateEvent(
  eventId: string,
  payload: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
): Promise<Event> {
  try {
    if (!eventId) {
      throw new Error('Event ID is required');
    }

    // Validate event type if provided
    if (payload.type && !['meeting', 'personal', 'leave'].includes(payload.type)) {
      throw new Error('Invalid event type. Must be: meeting, personal, or leave');
    }

    // Validate dates if provided
    if (payload.start || payload.end) {
      const startDate = payload.start ? new Date(payload.start) : null;
      const endDate = payload.end ? new Date(payload.end) : null;

      // If both are provided, validate them together
      if (startDate && endDate) {
        if (!isValid(startDate) || !isValid(endDate)) {
          throw new Error('Invalid date format. Use ISO 8601 format.');
        }
        if (isBefore(endDate, startDate) || isSameSecond(endDate, startDate)) {
          throw new Error('End date must be after start date');
        }
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Error updating event:', error);
      throw new Error(`Failed to update event: ${error.message}`);
    }

    if (!data) {
      throw new Error('Event update returned no data');
    }

    return data;
  } catch (error) {
    console.error('Error in updateEvent:', error);
    throw error;
  }
}

/**
 * Deletes an event
 * @param eventId - Event ID
 */
export async function deleteEvent(eventId: string): Promise<void> {
  try {
    if (!eventId) {
      throw new Error('Event ID is required');
    }

    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    throw error;
  }
}
