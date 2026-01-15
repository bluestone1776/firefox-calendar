import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// date-fns-tz is now used instead of dayjs
import { Profile, WeeklyHours, Event } from '../../types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../constants/time';
import { WorkingHoursShade } from './WorkingHoursShade';
import { EventBlock } from './EventBlock';
import { toZonedTime } from 'date-fns-tz';
import { isSameDay, getHours, getMinutes } from 'date-fns';
import { calculateEventLayouts } from '../../utils/schedule';

interface EmployeeColumnProps {
  profile: Profile;
  workingHours?: WeeklyHours;
  events: Event[];
  timezone: string;
  onEventPress?: (event: Event) => void;
  onEventLongPress?: (event: Event) => void;
  onEventDragEnd?: (event: Event, newStartTime: Date, newEndTime: Date) => void;
  onEmptyAreaPress?: (profileId: string, timeMinutes: number) => void;
  onEmptyAreaLongPress?: (profileId: string, timeMinutes: number) => void;
  onWorkingHoursPress?: (workingHours: WeeklyHours) => void;
  onWorkingHoursLongPress?: (workingHours: WeeklyHours) => void;
  dayStartHour?: number;
  dayEndHour?: number;
  showHeader?: boolean;
  getEventConflict?: (event: Event) => boolean;
}

export function EmployeeColumn({
  profile,
  workingHours,
  events,
  timezone,
  onEventPress,
  onEventLongPress,
  onEventDragEnd,
  onEmptyAreaPress,
  onEmptyAreaLongPress,
  onWorkingHoursPress,
  onWorkingHoursLongPress,
  dayStartHour = DAY_START_HOUR,
  dayEndHour = DAY_END_HOUR,
  showHeader = true,
  getEventConflict,
}: EmployeeColumnProps) {
  // Calculate total height based on day duration
  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const totalHeight = totalMinutes * PX_PER_MIN;

  // Check if there's an all-day leave event for this employee
  const hasAllDayLeave = events.some((event) => {
    if (event.type !== 'leave') return false;
    if (event.is_all_day) return true;
    
    // Also check if it spans the full day (00:00 to 23:59)
    const startTime = toZonedTime(new Date(event.start), timezone);
    const endTime = toZonedTime(new Date(event.end), timezone);
    return (
      isSameDay(startTime, endTime) &&
      getHours(startTime) === 0 && getMinutes(startTime) === 0 &&
      getHours(endTime) === 23 && getMinutes(endTime) === 59
    );
  });

  // Filter out all-day leave events from regular event blocks (they'll be shown via column color)
  const regularEvents = events.filter((event) => {
    if (event.type !== 'leave') return true;
    if (event.is_all_day) return false;
    
    const startTime = toZonedTime(new Date(event.start), timezone);
    const endTime = toZonedTime(new Date(event.end), timezone);
    const isAllDay = isSameDay(startTime, endTime) &&
      getHours(startTime) === 0 && getMinutes(startTime) === 0 &&
      getHours(endTime) === 23 && getMinutes(endTime) === 59;
    return !isAllDay;
  });

  // Calculate layout positions for overlapping events
  const eventLayouts = calculateEventLayouts(regularEvents, timezone);

  const handleTimelinePress = (event: any) => {
    if (!onEmptyAreaPress) return;
    // Get the touch location relative to the timeline
    const { locationY } = event.nativeEvent;
    // Calculate time in minutes from day start
    const timeMinutes = Math.floor(locationY / PX_PER_MIN);
    onEmptyAreaPress(profile.id, timeMinutes);
  };

  const handleTimelineLongPress = (event: any) => {
    if (!onEmptyAreaLongPress) return;
    // Get the touch location relative to the timeline
    const { locationY } = event.nativeEvent;
    // Calculate time in minutes from day start
    const timeMinutes = Math.floor(locationY / PX_PER_MIN);
    onEmptyAreaLongPress(profile.id, timeMinutes);
  };

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={[styles.header, hasAllDayLeave && styles.headerLeave]}>
          <Text style={[styles.name, hasAllDayLeave && styles.nameLeave]} numberOfLines={1}>
            {profile.email.split('@')[0]}
          </Text>
          {hasAllDayLeave && (
            <Text style={styles.leaveBadge}>🏖️ Leave</Text>
          )}
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.timeline, 
          { height: totalHeight },
          hasAllDayLeave && styles.timelineLeave
        ]}
        onPress={handleTimelinePress}
        onLongPress={handleTimelineLongPress}
        delayLongPress={500}
        activeOpacity={1}
      >
        {workingHours && !hasAllDayLeave && (
          <WorkingHoursShade 
            workingHours={workingHours} 
            dayStartHour={dayStartHour}
            onPress={onWorkingHoursPress}
            onLongPress={onWorkingHoursLongPress}
          />
        )}
        {regularEvents.map((event) => {
          const layout = eventLayouts.get(event.id);
          return (
            <EventBlock
              key={event.id}
              event={event}
              timezone={timezone}
              onPress={onEventPress}
              onLongPress={onEventLongPress}
              onDragEnd={onEventDragEnd}
              dayStartHour={dayStartHour}
              dayEndHour={dayEndHour}
              hasConflict={getEventConflict ? getEventConflict(event) : false}
              layout={layout}
            />
          );
        })}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 200,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  header: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeave: {
    backgroundColor: '#FFF3E0',
    borderBottomColor: '#FF9800',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  nameLeave: {
    color: '#E65100',
  },
  leaveBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 8,
  },
  timeline: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  timelineLeave: {
    backgroundColor: '#FFF8E1',
    opacity: 0.7,
  },
});
