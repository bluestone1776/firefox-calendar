import { format, parse, getHours, getMinutes, getDay, isAfter, isBefore, differenceInMilliseconds, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { WeeklyHours, Event, Profile } from '../types';

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
  dateTime: Date,
  tz: string,
  weeklyHours?: WeeklyHours,
  events: Event[] = []
): StatusInfo {
  const hour = getHours(dateTime);
  const minute = getMinutes(dateTime);
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
    const eventStart = toZonedTime(new Date(event.start), tz);
    const eventEnd = toZonedTime(new Date(event.end), tz);
    return isAfter(dateTime, eventStart) && isBefore(dateTime, eventEnd);
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
  selectedDate: Date,
  allWeeklyHours: Map<string, WeeklyHours>,
  allEvents: Map<string, Event[]>,
  tz: string
): Date | null {
  const now = toZonedTime(new Date(), tz);
  const checkDate = format(selectedDate, 'yyyy-MM-dd');
  const changeTimes: Date[] = [];

  // Collect all shift start/end times
  allWeeklyHours.forEach((hours) => {
    const shiftStart = toZonedTime(parse(`${checkDate} ${hours.start_hour}:${hours.start_minute}`, 'yyyy-MM-dd H:mm', new Date()), tz);
    const shiftEnd = toZonedTime(parse(`${checkDate} ${hours.end_hour}:${hours.end_minute}`, 'yyyy-MM-dd H:mm', new Date()), tz);
    changeTimes.push(shiftStart, shiftEnd);
  });

  // Collect all event start/end times
  allEvents.forEach((events) => {
    events.forEach((event) => {
      const eventStart = toZonedTime(new Date(event.start), tz);
      const eventEnd = toZonedTime(new Date(event.end), tz);
      if (format(eventStart, 'yyyy-MM-dd') === checkDate) {
        changeTimes.push(eventStart);
      }
      if (format(eventEnd, 'yyyy-MM-dd') === checkDate) {
        changeTimes.push(eventEnd);
      }
    });
  });

  // Filter to future times and find the earliest
  const futureChanges = changeTimes
    .filter((time) => isAfter(time, now))
    .sort((a, b) => differenceInMilliseconds(a, b));

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
  selectedDate: Date,
  allWeeklyHours: Map<string, WeeklyHours>,
  tz: string,
  paddingMinutes: number = 60,
  allEvents?: Map<string, Event[]>
): { startHour: number; endHour: number } {
  const checkDate = format(selectedDate, 'yyyy-MM-dd');
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
        const eventStart = toZonedTime(new Date(event.start), tz);
        const eventEnd = toZonedTime(new Date(event.end), tz);
        
        if (format(eventStart, 'yyyy-MM-dd') === checkDate) {
          hasAnyData = true;
          const startHour = getHours(eventStart) + getMinutes(eventStart) / 60;
          const endHour = getHours(eventEnd) + getMinutes(eventEnd) / 60;
          
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
  currentTime: Date,
  tz: string,
  weeklyHours?: WeeklyHours,
  events: Event[] = []
): { title: string; time: Date } | null {
  const checkDate = format(currentTime, 'yyyy-MM-dd');
  const blocks: { title: string; time: Date; type: 'event' | 'shift' }[] = [];

  // Add shift start if it's in the future
  if (weeklyHours) {
    const shiftStart = toZonedTime(parse(`${checkDate} ${weeklyHours.start_hour}:${weeklyHours.start_minute}`, 'yyyy-MM-dd H:mm', new Date()), tz);
    if (isAfter(shiftStart, currentTime)) {
      blocks.push({
        title: 'Shift starts',
        time: shiftStart,
        type: 'shift',
      });
    }
  }

  // Add upcoming events
  events.forEach((event) => {
    const eventStart = toZonedTime(new Date(event.start), tz);
    if (isAfter(eventStart, currentTime) && format(eventStart, 'yyyy-MM-dd') === checkDate) {
      blocks.push({
        title: event.title,
        time: eventStart,
        type: 'event',
      });
    }
  });

  // Sort by time and return the earliest
  blocks.sort((a, b) => differenceInMilliseconds(a.time, b.time));
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
  const eventStart = toZonedTime(new Date(event.start), tz);
  const eventEnd = toZonedTime(new Date(event.end), tz);

  return allEvents.some((otherEvent) => {
    if (otherEvent.id === event.id) return false; // Don't conflict with itself

    const otherStart = toZonedTime(new Date(otherEvent.start), tz);
    const otherEnd = toZonedTime(new Date(otherEvent.end), tz);

    // Events conflict if they overlap
    return (
      (isBefore(eventStart, otherEnd) && isAfter(eventEnd, otherStart)) ||
      (isBefore(otherStart, eventEnd) && isAfter(otherEnd, eventStart))
    );
  });
}

/**
 * Calculates layout positions for overlapping events
 * Groups overlapping events and assigns them side-by-side positions
 * @param events - All events to layout
 * @param tz - Timezone string
 * @returns Map of event ID to layout info { left, width, overlapIndex, totalOverlaps }
 */
export function calculateEventLayouts(
  events: Event[],
  tz: string
): Map<string, { left: number; width: number; overlapIndex: number; totalOverlaps: number }> {
  const layouts = new Map<string, { left: number; width: number; overlapIndex: number; totalOverlaps: number }>();
  
  if (events.length === 0) return layouts;

  // Convert events to time ranges
  const eventRanges = events.map((event) => {
    const start = toZonedTime(new Date(event.start), tz);
    const end = toZonedTime(new Date(event.end), tz);
    return {
      event,
      start: start.getTime(),
      end: end.getTime(),
    };
  });

  // Sort by start time
  eventRanges.sort((a, b) => a.start - b.start);

  // Find overlapping groups
  const groups: typeof eventRanges[] = [];
  let currentGroup: typeof eventRanges = [];

  for (let i = 0; i < eventRanges.length; i++) {
    const current = eventRanges[i];
    
    if (currentGroup.length === 0) {
      currentGroup.push(current);
    } else {
      // Check if current overlaps with any in current group
      const overlaps = currentGroup.some(
        (existing) =>
          (current.start < existing.end && current.end > existing.start)
      );

      if (overlaps) {
        currentGroup.push(current);
      } else {
        // Start a new group
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Calculate layout for each group
  groups.forEach((group) => {
    if (group.length === 1) {
      // Single event - full width
      layouts.set(group[0].event.id, {
        left: 0,
        width: 100,
        overlapIndex: 0,
        totalOverlaps: 1,
      });
    } else {
      // Multiple overlapping events - divide width
      const widthPercent = 100 / group.length;
      group.forEach((item, index) => {
        layouts.set(item.event.id, {
          left: index * widthPercent,
          width: widthPercent,
          overlapIndex: index,
          totalOverlaps: group.length,
        });
      });
    }
  });

  return layouts;
}
