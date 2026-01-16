import { View, Text, StyleSheet, Pressable } from 'react-native';
import { DAY_START_HOUR, PX_PER_MIN } from '../../constants/time';
import { WeeklyHours } from '../../types';

interface WorkingHoursShadeProps {
  workingHours: WeeklyHours;
  dayStartHour?: number;
  onPress?: (workingHours: WeeklyHours) => void;
  onLongPress?: (workingHours: WeeklyHours) => void;
}

export function WorkingHoursShade({ 
  workingHours, 
  dayStartHour = DAY_START_HOUR,
  onPress,
  onLongPress,
}: WorkingHoursShadeProps) {
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

  // Only render if the shade is within or overlaps the visible area
  // (height > 0 ensures valid range)
  if (height <= 0) {
    return null;
  }

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const startTime = formatTime(workingHours.start_hour, workingHours.start_minute);
  const endTime = formatTime(workingHours.end_hour, workingHours.end_minute);

  const content = (
    <View style={styles.content}>
      {height > 30 && (
        <Text style={styles.timeText} numberOfLines={1}>
          {startTime}
        </Text>
      )}
      {height > 50 && (
        <Text style={styles.labelText} numberOfLines={1}>
          Working Hours
        </Text>
      )}
      {height > 70 && (
        <Text style={styles.timeText} numberOfLines={1}>
          Until {endTime}
        </Text>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={() => onPress?.(workingHours)}
        onLongPress={() => onLongPress?.(workingHours)}
        delayLongPress={500}
      >
        <View
          style={[
            styles.shade,
            {
              top: Math.max(0, startPosition),
              height: height,
            },
          ]}
        >
          {content}
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.shade,
        {
          top: Math.max(0, startPosition),
          height: height,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#E8F5E9', // Light green background for better visibility
    opacity: 0.7,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50', // Green border to make it more visible
    padding: 4,
    justifyContent: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 2,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4CAF50',
    marginTop: 2,
  },
});
