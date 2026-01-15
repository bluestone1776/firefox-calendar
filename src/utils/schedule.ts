import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { WeeklyHours, Event, Profile } from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);

export type UserStatus = 'working' | 'busy' | 'off';

export interface StatusInfo {
  status: UserStatus;
  currentEvent?: Event;
  shiftHours?: WeeklyHours;
}

/**
 * Computes the status of a user at a specific time
 * @param userId - User ID
 * @param dateTime - Date and time in the target timezone
 * @param weeklyHours - Weekly hours for the user (for the weekday)
 * @param events - Events for the user on that date
 * @param tz - Timezone string
 */
export function computeStatusForUserAtTime(
  userId: string,
  dateTime: dayjs.Dayjs,
  tz: string,
  weeklyHours?: WeeklyHours,
  events: Event[] = []
): StatusInfo {
  const hour = dateTime.hour();
  const minute = dateTime.minute();
  const timeInMinutes = hour * 60 + minute;

  // Check if user has a shift today
  const hasShift = weeklyHours !== undefined;
  let isInShift = false;

  if (hasShift && weeklyHours) {
    const shiftStart = weeklyHours.start_hour * 60 + weeklyHours.start_minute;
    const shiftEnd = weeklyHours.end_hour * 60 + weeklyHours.end_minute;
    isInShift = timeInMinutes >= shiftStart && timeInMinutes < shiftEnd;
  }

  // Check if user has an event at this time
  const currentEvent = events.find((event) => {
    const eventStart = dayjs(event.start).utc().tz(tz);
    const eventEnd = dayjs(event.end).utc().tz(tz);
    return dateTime.isAfter(eventStart) && dateTime.isBefore(eventEnd);
  });

  // Determine status
  if (currentEvent) {
    return {
      status: 'busy',
      currentEvent,
      shiftHours: weeklyHours,
    };
  }

  if (isInShift) {
    return {
      status: 'working',
      shiftHours: weeklyHours,
    };
  }

  return {
    status: 'off',
    shiftHours: weeklyHours,
  };
}

/**
 * Computes the next time when any staff member's status changes
 * @param selectedDate - The date to check
 * @param allWeeklyHours - Map of userId -> WeeklyHours for that weekday
 * @param allEvents - Map of userId -> Events[] for that date
 * @param tz - Timezone string
 */
export function computeNextChangeAcrossStaff(
  selectedDate: dayjs.Dayjs,
  allWeeklyHours: Map<string, WeeklyHours>,
  allEvents: Map<string, Event[]>,
  tz: string
): dayjs.Dayjs | null {
  const now = dayjs.tz(undefined, tz);
  const checkDate = selectedDate.format('YYYY-MM-DD');
  const changeTimes: dayjs.Dayjs[] = [];

  // Collect all shift start/end times
  allWeeklyHours.forEach((hours) => {
    const shiftStart = dayjs.tz(
      `${checkDate} ${hours.start_hour}:${hours.start_minute}`,
      tz
    );
    const shiftEnd = dayjs.tz(
      `${checkDate} ${hours.end_hour}:${hours.end_minute}`,
      tz
    );
    changeTimes.push(shiftStart, shiftEnd);
  });

  // Collect all event start/end times
  allEvents.forEach((events) => {
    events.forEach((event) => {
      const eventStart = dayjs(event.start).utc().tz(tz);
      const eventEnd = dayjs(event.end).utc().tz(tz);
      if (eventStart.format('YYYY-MM-DD') === checkDate) {
        changeTimes.push(eventStart);
      }
      if (eventEnd.format('YYYY-MM-DD') === checkDate) {
        changeTimes.push(eventEnd);
      }
    });
  });

  // Filter to future times and find the earliest
  const futureChanges = changeTimes
    .filter((time) => time.isAfter(now))
    .sort((a, b) => a.diff(b));

  return futureChanges.length > 0 ? futureChanges[0] : null;
}

/**
 * Computes the optimal day range based on staff shifts and events
 * @param selectedDate - The date to check
 * @param allWeeklyHours - Map of userId -> WeeklyHours for that weekday
 * @param allEvents - Map of userId -> Events[] for that date
 * @param tz - Timezone string
 * @param paddingMinutes - Padding to add before/after (default 60)
 */
export function computeAutoDayRangeFromShifts(
  selectedDate: dayjs.Dayjs,
  allWeeklyHours: Map<string, WeeklyHours>,
  tz: string,
  paddingMinutes: number = 60,
  allEvents?: Map<string, Event[]>
): { startHour: number; endHour: number } {
  const checkDate = selectedDate.format('YYYY-MM-DD');
  let earliestStart = 23;
  let latestEnd = 0;
  let hasAnyData = false;

  // Check shifts
  allWeeklyHours.forEach((hours) => {
    hasAnyData = true;
    const shiftStart = hours.start_hour + hours.start_minute / 60;
    const shiftEnd = hours.end_hour + hours.end_minute / 60;

    if (shiftStart < earliestStart) {
      earliestStart = shiftStart;
    }
    if (shiftEnd > latestEnd) {
      latestEnd = shiftEnd;
    }
  });

  // Check events
  if (allEvents) {
    allEvents.forEach((events) => {
      events.forEach((event) => {
        const eventStart = dayjs(event.start).utc().tz(tz);
        const eventEnd = dayjs(event.end).utc().tz(tz);
        
        if (eventStart.format('YYYY-MM-DD') === checkDate) {
          hasAnyData = true;
          const startHour = eventStart.hour() + eventStart.minute() / 60;
          const endHour = eventEnd.hour() + eventEnd.minute() / 60;
          
          if (startHour < earliestStart) {
            earliestStart = startHour;
          }
          if (endHour > latestEnd) {
            latestEnd = endHour;
          }
        }
      });
    });
  }

  if (!hasAnyData) {
    // Default fallback
    return { startHour: 6, endHour: 20 };
  }

  // Apply padding
  let startHour = Math.max(0, Math.floor(earliestStart) - Math.ceil(paddingMinutes / 60));
  let endHour = Math.min(24, Math.ceil(latestEnd) + Math.ceil(paddingMinutes / 60));

  // Ensure minimum range of at least 8 hours (6am-2pm or wider)
  const minRange = 8;
  if (endHour - startHour < minRange) {
    // Center the range around the data, but ensure minimum span
    const center = (earliestStart + latestEnd) / 2;
    startHour = Math.max(0, Math.floor(center - minRange / 2));
    endHour = Math.min(24, Math.ceil(center + minRange / 2));
  }

  // Ensure we show at least from 6am to 8pm if there's any data
  startHour = Math.min(startHour, 6);
  endHour = Math.max(endHour, 20);

  return { startHour, endHour };
}

/**
 * Gets the next block (event or shift) for a user
 */
export function getNextBlockForUser(
  userId: string,
  currentTime: dayjs.Dayjs,
  tz: string,
  weeklyHours?: WeeklyHours,
  events: Event[] = []
): { title: string; time: dayjs.Dayjs } | null {
  const checkDate = currentTime.format('YYYY-MM-DD');
  const blocks: { title: string; time: dayjs.Dayjs; type: 'event' | 'shift' }[] = [];

  // Add shift start if it's in the future
  if (weeklyHours) {
    const shiftStart = dayjs.tz(
      `${checkDate} ${weeklyHours.start_hour}:${weeklyHours.start_minute}`,
      tz
    );
    if (shiftStart.isAfter(currentTime)) {
      blocks.push({
        title: 'Shift starts',
        time: shiftStart,
        type: 'shift',
      });
    }
  }

  // Add upcoming events
  events.forEach((event) => {
    const eventStart = dayjs(event.start).utc().tz(tz);
    if (eventStart.isAfter(currentTime) && eventStart.format('YYYY-MM-DD') === checkDate) {
      blocks.push({
        title: event.title,
        time: eventStart,
        type: 'event',
      });
    }
  });

  // Sort by time and return the earliest
  blocks.sort((a, b) => a.time.diff(b.time));
  return blocks.length > 0 ? { title: blocks[0].title, time: blocks[0].time } : null;
}

/**
 * Detects if an event conflicts (overlaps) with other events for the same user
 * @param event - The event to check
 * @param allEvents - All events for the user on that date
 * @param tz - Timezone string
 */
export function hasEventConflict(
  event: Event,
  allEvents: Event[],
  tz: string
): boolean {
  const eventStart = dayjs(event.start).utc().tz(tz);
  const eventEnd = dayjs(event.end).utc().tz(tz);

  return allEvents.some((otherEvent) => {
    if (otherEvent.id === event.id) return false; // Don't conflict with itself

    const otherStart = dayjs(otherEvent.start).utc().tz(tz);
    const otherEnd = dayjs(otherEvent.end).utc().tz(tz);

    // Events conflict if they overlap
    return (
      (eventStart.isBefore(otherEnd) && eventEnd.isAfter(otherStart)) ||
      (otherStart.isBefore(eventEnd) && otherEnd.isAfter(eventStart))
    );
  });
}
