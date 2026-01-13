import { View, Text, StyleSheet } from 'react-native';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../constants/time';

export function TimeGutter() {
  const hours: number[] = [];
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour++) {
    hours.push(hour);
  }

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const getPosition = (hour: number) => {
    const minutesFromStart = (hour - DAY_START_HOUR) * 60;
    return minutesFromStart * PX_PER_MIN;
  };

  return (
    <View style={styles.container}>
      {hours.map((hour) => (
        <View
          key={hour}
          style={[
            styles.timeLabel,
            {
              top: getPosition(hour),
            },
          ]}
        >
          <Text style={styles.timeText}>{formatTime(hour)}</Text>
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
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: '#FFFFFF',
    paddingRight: 8,
  },
});
