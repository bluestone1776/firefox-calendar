import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// date-fns-tz is now used instead of dayjs
import { Profile, WeeklyHours, Event } from '../../types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../constants/time';
import { WorkingHoursShade } from './WorkingHoursShade';
import { EventBlock } from './EventBlock';

interface EmployeeColumnProps {
  profile: Profile;
  workingHours?: WeeklyHours;
  events: Event[];
  timezone: string;
  onEventPress?: (event: Event) => void;
  onEventLongPress?: (event: Event) => void;
  onEventDragEnd?: (event: Event, newStartTime: Date, newEndTime: Date) => void;
  onEmptyAreaPress?: (profileId: string, timeMinutes: number) => void;
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

  const handleTimelinePress = (event: any) => {
    if (!onEmptyAreaPress) return;
    // Get the touch location relative to the timeline
    const { locationY } = event.nativeEvent;
    // Calculate time in minutes from day start
    const timeMinutes = Math.floor(locationY / PX_PER_MIN);
    onEmptyAreaPress(profile.id, timeMinutes);
  };

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.email.split('@')[0]}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.timeline, { height: totalHeight }]}
        onPress={handleTimelinePress}
        activeOpacity={1}
      >
        {workingHours && (
          <WorkingHoursShade 
            workingHours={workingHours} 
            dayStartHour={dayStartHour}
            onPress={onWorkingHoursPress}
            onLongPress={onWorkingHoursLongPress}
          />
        )}
        {events.map((event) => (
          <EventBlock
            key={event.id}
            event={event}
            timezone={timezone}
            onPress={onEventPress}
            onLongPress={onEventLongPress}
            onDragEnd={onEventDragEnd}
            dayStartHour={dayStartHour}
            hasConflict={getEventConflict ? getEventConflict(event) : false}
          />
        ))}
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
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  timeline: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
});
