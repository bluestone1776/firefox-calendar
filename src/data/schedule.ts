import { parse, startOfDay, endOfDay, isValid, isBefore, isSameSecond } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '../lib/supabase';
import { WeeklyHours, Event } from '../types';

/**
 * Gets weekly hours for a specific user
 * @param userId - User ID
 */
export async function getWeeklyHoursForUser(
  userId: string
): Promise<WeeklyHours[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_hours')
      .select('*')
      .eq('profile_id', userId)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching weekly hours:', error);
      throw new Error(`Failed to fetch weekly hours: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getWeeklyHoursForUser:', error);
    throw error;
  }
}

/**
 * Gets weekly hours for all users for a specific weekday
 * @param weekday - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export async function getWeeklyHoursForWeekday(
  weekday: number
): Promise<WeeklyHours[]> {
  try {
    if (weekday < 0 || weekday > 6) {
      throw new Error('Weekday must be between 0 (Sunday) and 6 (Saturday)');
    }

    const { data, error } = await supabase
      .from('weekly_hours')
      .select('*')
      .eq('day_of_week', weekday)
      .order('profile_id', { ascending: true });

    if (error) {
      console.error('Error fetching weekly hours:', error);
      throw new Error(`Failed to fetch weekly hours: ${error.message}`);
    }

    return data || [];
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

    // Convert to UTC for database query
    const dayStartUTC = fromZonedTime(dayStart, tz).toISOString();
    const dayEndUTC = fromZonedTime(dayEnd, tz).toISOString();

    // Query events that overlap with the day
    // An event overlaps if:
    // - event.start < dayEnd AND event.end > dayStart
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .lt('start', dayEndUTC)
      .gt('end', dayStartUTC)
      .order('start', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEventsForDate:', error);
    throw error;
  }
}

/**
 * Upserts weekly hours for a user
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

    // First, delete existing weekly hours for this user
    const { error: deleteError } = await supabase
      .from('weekly_hours')
      .delete()
      .eq('profile_id', userId);

    if (deleteError) {
      console.error('Error deleting existing weekly hours:', deleteError);
      throw new Error(
        `Failed to delete existing weekly hours: ${deleteError.message}`
      );
    }

    // Insert new rows
    if (rows.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('weekly_hours')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error upserting weekly hours:', error);
      throw new Error(`Failed to upsert weekly hours: ${error.message}`);
    }

    return data || [];
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

    if (!['meeting', 'personal', 'leave'].includes(payload.type)) {
      throw new Error('Invalid event type. Must be: meeting, personal, or leave');
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
