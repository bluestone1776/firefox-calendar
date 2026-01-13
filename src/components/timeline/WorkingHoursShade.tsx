import { View, StyleSheet } from 'react-native';
import { DAY_START_HOUR, PX_PER_MIN } from '../../constants/time';
import { WeeklyHours } from '../../types';

interface WorkingHoursShadeProps {
  workingHours: WeeklyHours;
  dayStartHour?: number;
}

export function WorkingHoursShade({ workingHours, dayStartHour = DAY_START_HOUR }: WorkingHoursShadeProps) {
  const getPosition = (hour: number, minute: number) => {
    const minutesFromStart = (hour - dayStartHour) * 60 + minute;
    return minutesFromStart * PX_PER_MIN;
  };

  const startPosition = getPosition(
    workingHours.start_hour,
    workingHours.start_minute
  );
  const endPosition = getPosition(
    workingHours.end_hour,
    workingHours.end_minute
  );
  const height = endPosition - startPosition;

  return (
    <View
      style={[
        styles.shade,
        {
          top: startPosition,
          height: height,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#F0F0F0',
    opacity: 0.5,
  },
});
