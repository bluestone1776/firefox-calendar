import { View, StyleSheet } from 'react-native';
import { DAY_START_HOUR, PX_PER_MIN } from '../../constants/time';
import { WeeklyHours } from '../../types';

interface WorkingHoursShadeProps {
  workingHours: WeeklyHours;
}

export function WorkingHoursShade({ workingHours }: WorkingHoursShadeProps) {
  const getPosition = (hour: number, minute: number) => {
    const minutesFromStart = (hour - DAY_START_HOUR) * 60 + minute;
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
