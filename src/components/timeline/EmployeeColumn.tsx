import { View, Text, StyleSheet } from 'react-native';
import { Profile, WeeklyHours, Event } from '../../types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../constants/time';
import { WorkingHoursShade } from './WorkingHoursShade';
import { EventBlock } from './EventBlock';

interface EmployeeColumnProps {
  profile: Profile;
  workingHours?: WeeklyHours;
  events: Event[];
  timezone: string;
}

export function EmployeeColumn({
  profile,
  workingHours,
  events,
  timezone,
}: EmployeeColumnProps) {
  // Calculate total height based on day duration
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const totalHeight = totalMinutes * PX_PER_MIN;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.email.split('@')[0]}
        </Text>
      </View>
      <View style={[styles.timeline, { height: totalHeight }]}>
        {workingHours && <WorkingHoursShade workingHours={workingHours} />}
        {events.map((event) => (
          <EventBlock key={event.id} event={event} timezone={timezone} />
        ))}
      </View>
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
