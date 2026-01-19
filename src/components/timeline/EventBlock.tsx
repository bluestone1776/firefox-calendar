import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Pressable } from 'react-native';
import { Event } from '../../types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN, TIME_BLOCK_MINUTES } from '../../constants/time';
import { format, getHours, getMinutes, differenceInMinutes, addMinutes, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface EventBlockProps {
  event: Event;
  timezone: string;
  onPress?: (event: Event) => void;
  onLongPress?: (event: Event) => void;
  onDragEnd?: (event: Event, newStartTime: Date, newEndTime: Date) => void;
  dayStartHour?: number;
  dayEndHour?: number;
  hasConflict?: boolean;
  layout?: { left: number; width: number; overlapIndex: number; totalOverlaps: number };
}

export function EventBlock({
  event,
  timezone,
  onPress,
  onLongPress,
  onDragEnd,
  dayStartHour = DAY_START_HOUR,
  dayEndHour = DAY_END_HOUR,
  hasConflict = false,
  layout,
}: EventBlockProps) {
  // Parse event times from UTC and convert to the given timezone
  // Events are stored as UTC ISO strings, so parse as UTC first, then convert to target timezone
  const startTime = toZonedTime(new Date(event.start), timezone);
  const endTime = toZonedTime(new Date(event.end), timezone);
  
  // Check if this is an all-day leave event (spans full day)
  const isAllDayLeave = event.type === 'leave' && 
    (event.is_all_day || 
     (isSameDay(startTime, endTime) && 
      getHours(startTime) === 0 && getMinutes(startTime) === 0 &&
      getHours(endTime) === 23 && getMinutes(endTime) === 59));

  // For all-day leave, span the full visible day
  const durationMinutes = isAllDayLeave 
    ? (dayEndHour - dayStartHour) * 60 
    : differenceInMinutes(endTime, startTime);

  // Calculate position based on minutes from day start
  const getPosition = (date: Date) => {
    const hour = getHours(date);
    const minute = getMinutes(date);
    const minutesFromStart = (hour - dayStartHour) * 60 + minute;
    return minutesFromStart * PX_PER_MIN;
  };

  // For all-day leave, start at the top of the visible day
  const initialStartPosition = isAllDayLeave ? 0 : getPosition(startTime);
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
        // Also check that horizontal movement is minimal to avoid interfering with horizontal scroll
        const isFromTop = gestureState.moveY - gestureState.y0 < 40; // Top 40px of event
        const isVerticalGesture = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
        return Math.abs(gestureState.dy) > 10 && isFromTop && isVerticalGesture;
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
          const newStartTime = addMinutes(startTime, deltaMinutes);
          const newEndTime = addMinutes(endTime, deltaMinutes);
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
      {/* Conflict indicator - show when overlapping */}
      {layout && layout.totalOverlaps > 1 && (
        <View style={styles.overlapIndicator}>
          <Text style={styles.overlapBadge}>
            {layout.overlapIndex + 1}/{layout.totalOverlaps}
          </Text>
        </View>
      )}
      {/* Conflict warning - show when has conflict but not in layout (edge case) */}
      {hasConflict && (!layout || layout.totalOverlaps === 1) && (
        <View style={styles.conflictIndicator}>
          <View style={styles.conflictDot} />
        </View>
      )}
      
      {isAllDayLeave ? (
        // All-day leave display
        <>
          <View style={styles.allDayBadge}>
            <Text style={styles.allDayText}>ALL DAY</Text>
          </View>
          <Text style={[styles.title, getTypeTextStyle()]} numberOfLines={height > 50 ? 2 : 1}>
            {event.title || 'Leave'}
          </Text>
          {height > 60 && (
            <Text style={[styles.allDaySubtext, getTypeTextStyle()]} numberOfLines={1}>
              Unavailable
            </Text>
          )}
        </>
      ) : (
        // Regular event display
        <>
          <View style={styles.timeHeader}>
            <Text style={[styles.timeStart, getTypeTextStyle()]} numberOfLines={1}>
              {format(startTime, 'h:mm')}
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
          
          {/* Only show "Until" for events longer than 30 minutes to avoid overflow */}
          {height > 50 && durationMinutes > 30 && (
            <Text style={[styles.timeEnd, getTypeTextStyle()]} numberOfLines={1}>
              Until {format(endTime, 'h:mm a')}
            </Text>
          )}
        </>
      )}

      {/* Drag indicator */}
      {isDragging && (
        <View style={styles.dragIndicator}>
          <Text style={styles.dragText}>
            {format(addMinutes(startTime, Math.round((dragY as any)._value / PX_PER_MIN / TIME_BLOCK_MINUTES) * TIME_BLOCK_MINUTES), 'h:mm a')}
          </Text>
        </View>
      )}

    </>
  );

  // Calculate layout styles for overlapping events
  // Column width is typically 200px (minWidth), so we calculate based on that
  const COLUMN_WIDTH = 200;
  const HORIZONTAL_PADDING = 4; // left/right padding from block style
  const AVAILABLE_WIDTH = COLUMN_WIDTH - (HORIZONTAL_PADDING * 2);
  
  const layoutStyle = layout
    ? {
        left: HORIZONTAL_PADDING + (layout.left / 100) * AVAILABLE_WIDTH,
        width: (layout.width / 100) * AVAILABLE_WIDTH - (layout.totalOverlaps > 1 ? 2 : 0),
      }
    : {
        left: HORIZONTAL_PADDING,
        right: HORIZONTAL_PADDING,
      };

  const blockStyle = [
    styles.block,
    getTypeStyle(),
    isDragging && styles.dragging,
    hasConflict && styles.conflict,
    isPressed && styles.pressed,
    layoutStyle,
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
        hitSlop={8}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
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
        hitSlop={8}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
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
  allDayBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  allDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  allDaySubtext: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.8,
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
  overlapIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  overlapBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
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
