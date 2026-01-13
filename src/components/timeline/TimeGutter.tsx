import { View, Text, StyleSheet } from 'react-native';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../constants/time';

interface TimeGutterProps {
  startHour?: number;
  endHour?: number;
}

export function TimeGutter({ startHour = DAY_START_HOUR, endHour = DAY_END_HOUR }: TimeGutterProps = {}) {
  const timeSlots: { hour: number; minute: number }[] = [];
  
  // Generate time slots every 30 minutes for better readability
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === endHour && minute > 0) break; // Don't go past endHour
      timeSlots.push({ hour, minute });
    }
  }

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    if (minute === 0) {
      return `${displayHour}:00 ${period}`;
    }
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const getPosition = (hour: number, minute: number) => {
    const minutesFromStart = (hour - startHour) * 60 + minute;
    return minutesFromStart * PX_PER_MIN;
  };

  return (
    <View style={styles.container}>
      {timeSlots.map((slot, index) => (
        <View
          key={`${slot.hour}-${slot.minute}`}
          style={[
            styles.timeLabel,
            slot.minute === 0 ? styles.hourLabel : styles.halfHourLabel,
            {
              top: getPosition(slot.hour, slot.minute),
            },
          ]}
        >
          <Text
            style={[
              styles.timeText,
              slot.minute === 0 ? styles.hourText : styles.halfHourText,
            ]}
          >
            {formatTime(slot.hour, slot.minute)}
          </Text>
          {slot.minute === 0 && <View style={styles.timeLine} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    position: 'relative',
  },
  timeLabel: {
    position: 'absolute',
    left: 0,
    height: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    height: 20,
  },
  halfHourLabel: {
    height: 1,
    opacity: 0.5,
  },
  timeText: {
    fontSize: 11,
    color: '#666666',
    backgroundColor: '#FFFFFF',
    paddingRight: 4,
  },
  hourText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  halfHourText: {
    fontSize: 10,
    color: '#999999',
  },
  timeLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
});
