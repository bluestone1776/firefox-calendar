import { View, Text, StyleSheet } from 'react-native';
import { Event } from '../../types';
import { DAY_START_HOUR, PX_PER_MIN } from '../../constants/time';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface EventBlockProps {
  event: Event;
  timezone: string;
}

export function EventBlock({ event, timezone }: EventBlockProps) {
  // Parse event times in the given timezone
  const startTime = dayjs.tz(event.start, timezone);
  const endTime = dayjs.tz(event.end, timezone);

  // Calculate position based on minutes from day start
  const getPosition = (date: dayjs.Dayjs) => {
    const hour = date.hour();
    const minute = date.minute();
    const minutesFromStart = (hour - DAY_START_HOUR) * 60 + minute;
    return minutesFromStart * PX_PER_MIN;
  };

  const startPosition = getPosition(startTime);
  const durationMinutes = endTime.diff(startTime, 'minute');
  const height = durationMinutes * PX_PER_MIN;

  // Style based on event type
  const getTypeStyle = () => {
    switch (event.type) {
      case 'meeting':
        return styles.meeting;
      case 'personal':
        return styles.personal;
      case 'leave':
        return styles.leave;
      default:
        return styles.default;
    }
  };

  const getTypeTextStyle = () => {
    switch (event.type) {
      case 'meeting':
        return styles.meetingText;
      case 'personal':
        return styles.personalText;
      case 'leave':
        return styles.leaveText;
      default:
        return styles.defaultText;
    }
  };

  return (
    <View
      style={[
        styles.block,
        getTypeStyle(),
        {
          top: startPosition,
          height: Math.max(height, 20), // Minimum height for visibility
        },
      ]}
    >
      <Text style={[styles.title, getTypeTextStyle()]} numberOfLines={2}>
        {event.title}
      </Text>
      <Text style={[styles.time, getTypeTextStyle()]} numberOfLines={1}>
        {startTime.format('h:mm A')} - {endTime.format('h:mm A')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: 4,
    right: 4,
    padding: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  meeting: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  personal: {
    backgroundColor: '#F3E5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  leave: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  default: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 3,
    borderLeftColor: '#9E9E9E',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  time: {
    fontSize: 10,
    opacity: 0.8,
  },
  meetingText: {
    color: '#1565C0',
  },
  personalText: {
    color: '#6A1B9A',
  },
  leaveText: {
    color: '#E65100',
  },
  defaultText: {
    color: '#424242',
  },
});
