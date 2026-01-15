import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Pressable } from 'react-native';
import { Event } from '../../types';
import { DAY_START_HOUR, PX_PER_MIN, TIME_BLOCK_MINUTES } from '../../constants/time';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface EventBlockProps {
  event: Event;
  timezone: string;
  onPress?: (event: Event) => void;
  onLongPress?: (event: Event) => void;
  onDragEnd?: (event: Event, newStartTime: dayjs.Dayjs, newEndTime: dayjs.Dayjs) => void;
  dayStartHour?: number;
  hasConflict?: boolean;
}

export function EventBlock({
  event,
  timezone,
  onPress,
  onLongPress,
  onDragEnd,
  dayStartHour = DAY_START_HOUR,
  hasConflict = false,
}: EventBlockProps) {
  // Parse event times from UTC and convert to the given timezone
  // Events are stored as UTC ISO strings, so parse as UTC first, then convert to target timezone
  const startTime = dayjs(event.start).utc().tz(timezone);
  const endTime = dayjs(event.end).utc().tz(timezone);
  const durationMinutes = endTime.diff(startTime, 'minute');

  // Calculate position based on minutes from day start
  const getPosition = (date: dayjs.Dayjs) => {
    const hour = date.hour();
    const minute = date.minute();
    const minutesFromStart = (hour - dayStartHour) * 60 + minute;
    return minutesFromStart * PX_PER_MIN;
  };

  const initialStartPosition = getPosition(startTime);
  const [dragY] = useState(new Animated.Value(0));
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const dragStartY = useRef(0);

  // Move drag handler
  const movePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start dragging if vertical movement is significant and not from bottom edge
        const isFromTop = gestureState.moveY - gestureState.y0 < 40; // Top 40px of event
        return Math.abs(gestureState.dy) > 10 && isFromTop;
      },
      onPanResponderGrant: (_, gestureState) => {
        dragStartY.current = gestureState.moveY;
        setIsDragging(true);
        dragY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        const deltaY = gestureState.dy;
        const deltaMinutes = Math.round(deltaY / PX_PER_MIN / TIME_BLOCK_MINUTES) * TIME_BLOCK_MINUTES;

        if (deltaMinutes !== 0 && onDragEnd) {
          const newStartTime = startTime.add(deltaMinutes, 'minute');
          const newEndTime = endTime.add(deltaMinutes, 'minute');
          onDragEnd(event, newStartTime, newEndTime);
        }

        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
      },
    })
  ).current;

  const animatedTop = dragY.interpolate({
    inputRange: [-2000, 2000],
    outputRange: [initialStartPosition - 2000, initialStartPosition + 2000],
    extrapolate: 'clamp',
  });

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

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };


  const content = (
    <>
      {/* Conflict indicator */}
      {hasConflict && (
        <View style={styles.conflictIndicator}>
          <View style={styles.conflictDot} />
        </View>
      )}
      
      <View style={styles.timeHeader}>
        <Text style={[styles.timeStart, getTypeTextStyle()]} numberOfLines={1}>
          {startTime.format('h:mm')}
        </Text>
        {height > 40 && (
          <Text style={[styles.duration, getTypeTextStyle()]} numberOfLines={1}>
            {formatDuration(durationMinutes)}
          </Text>
        )}
      </View>
      
      <Text style={[styles.title, getTypeTextStyle()]} numberOfLines={height > 50 ? 2 : 1}>
        {event.title}
      </Text>
      
      {height > 50 && (
        <Text style={[styles.timeEnd, getTypeTextStyle()]} numberOfLines={1}>
          Until {endTime.format('h:mm A')}
        </Text>
      )}

      {/* Drag indicator */}
      {isDragging && (
        <View style={styles.dragIndicator}>
          <Text style={styles.dragText}>
            {startTime.add(Math.round((dragY as any)._value / PX_PER_MIN / TIME_BLOCK_MINUTES) * TIME_BLOCK_MINUTES, 'minute').format('h:mm A')}
          </Text>
        </View>
      )}

    </>
  );

  const blockStyle = [
    styles.block,
    getTypeStyle(),
    isDragging && styles.dragging,
    hasConflict && styles.conflict,
    isPressed && styles.pressed,
  ];

  const handlePress = () => {
    if (onPress) {
      onPress(event);
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(event);
    }
  };

  if (onDragEnd) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        delayLongPress={500}
      >
        <Animated.View
          style={[
            blockStyle,
            {
              top: isDragging ? animatedTop : initialStartPosition,
              height: height,
              opacity: isDragging ? 0.9 : 1,
              transform: [
                { scale: isDragging ? 1.05 : isPressed ? 1.02 : 1 },
              ],
            },
          ]}
          {...movePanResponder.panHandlers}
        >
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        delayLongPress={500}
      >
        <Animated.View
          style={[
            blockStyle,
            {
              top: initialStartPosition,
              height: height,
              transform: [{ scale: isPressed ? 1.02 : 1 }],
            },
          ]}
        >
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        blockStyle,
        {
          top: initialStartPosition,
          height: height,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: 4,
    right: 4,
    padding: 10,
    borderRadius: 8,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dragging: {
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  pressed: {
    opacity: 0.95,
  },
  conflict: {
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderStyle: 'dashed',
  },
  meeting: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
  },
  personal: {
    backgroundColor: '#F3E5F5',
    borderLeftWidth: 5,
    borderLeftColor: '#9C27B0',
  },
  leave: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
  },
  default: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 5,
    borderLeftColor: '#9E9E9E',
  },
  conflictIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  conflictDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeStart: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.95,
  },
  duration: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.75,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  timeEnd: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.85,
    marginTop: 4,
  },
  dragIndicator: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dragText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
