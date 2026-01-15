import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { listProfiles } from '../../src/data/profiles';
import {
  getWeeklyHoursForWeekday,
  getEventsForDate,
  deleteEvent,
  updateEvent,
  createEvent,
} from '../../src/data/schedule';
import { Profile, WeeklyHours, Event } from '../../src/types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../src/constants/time';
import { TimeGutter } from '../../src/components/timeline/TimeGutter';
import { EmployeeColumn } from '../../src/components/timeline/EmployeeColumn';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../../src/components/ui/Button';
import { DailyConfirmation } from '../../src/components/payroll/DailyConfirmation';
import {
  computeStatusForUserAtTime,
  computeNextChangeAcrossStaff,
  computeAutoDayRangeFromShifts,
  getNextBlockForUser,
  hasEventConflict,
  UserStatus,
} from '../../src/utils/schedule';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = process.env.EXPO_PUBLIC_DEFAULT_TZ || 'Australia/Sydney';

export default function DailyScreen() {
  const router = useRouter();
  const { isAdmin, user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => dayjs.tz(undefined, getDefaultTimezone()));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<Map<string, WeeklyHours>>(
    new Map()
  );
  const [events, setEvents] = useState<Map<string, Event[]>>(new Map());
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'availability'>('timeline');
  const [useFullDay, setUseFullDay] = useState(false);
  const [autoDayRange, setAutoDayRange] = useState({ startHour: DAY_START_HOUR, endHour: DAY_END_HOUR });
  const [currentTimezone, setCurrentTimezone] = useState<string>(getDefaultTimezone());
  const verticalScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const headerScrollRef = useRef<ScrollView>(null);
  const isFirstMount = useRef(true);

  // Calculate day range
  const dayStartHour = useFullDay ? DAY_START_HOUR : autoDayRange.startHour;
  const dayEndHour = useFullDay ? DAY_END_HOUR : autoDayRange.endHour;
  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const totalHeight = totalMinutes * PX_PER_MIN;

  // Load timezone on mount
  useEffect(() => {
    loadTimezone();
  }, []);

  // Update currentDate timezone when timezone changes (but only after initial load)
  useEffect(() => {
    // Convert currentDate to the new timezone while preserving the same calendar date
    // Only update if timezone has actually changed from default
    if (!isFirstMount.current) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      setCurrentDate(dayjs.tz(dateStr, currentTimezone));
    }
  }, [currentTimezone]);

  // Load data for current date
  useEffect(() => {
    // Check if this is the first load
    const isFirstLoad = isFirstMount.current;
    if (isFirstMount.current) {
      isFirstMount.current = false;
    }
    loadData(isFirstLoad);
  }, [currentDate, currentTimezone]);

  const loadTimezone = async () => {
    try {
      const tz = await getTimezone();
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadData = async (isInitial = false) => {
    // Only show full loading screen on initial load
    if (isInitial) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      // Get weekday (0 = Sunday, 1 = Monday, etc.)
      // Ensure currentDate is in the correct timezone
      const dateInTimezone = currentDate.tz(currentTimezone);
      const weekday = dateInTimezone.day();

      // Get date in ISO format (YYYY-MM-DD) in the target timezone
      const dateISO = dateInTimezone.format('YYYY-MM-DD');

      // Load profiles
      const profilesData = await listProfiles();
      setProfiles(profilesData);

      // Load weekly hours for this weekday
      const hoursData = await getWeeklyHoursForWeekday(weekday);
      const hoursMap = new Map<string, WeeklyHours>();
      hoursData.forEach((hours) => {
        hoursMap.set(hours.profile_id, hours);
      });
      setWeeklyHours(hoursMap);

      // Load events for this date
      const eventsData = await getEventsForDate(dateISO, currentTimezone);
      const eventsMap = new Map<string, Event[]>();
      eventsData.forEach((event) => {
        const existing = eventsMap.get(event.profile_id) || [];
        eventsMap.set(event.profile_id, [...existing, event]);
      });
      setEvents(eventsMap);

      // Compute auto day range (include events for better range calculation)
      const range = computeAutoDayRangeFromShifts(dateInTimezone, hoursMap, currentTimezone, 60, eventsMap);
      // Ensure minimum range for better UX
      const minStartHour = Math.min(range.startHour, DAY_START_HOUR);
      const maxEndHour = Math.max(range.endHour, DAY_END_HOUR);
      setAutoDayRange({ startHour: minStartHour, endHour: maxEndHour });
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load calendar data');
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(dayjs.tz(undefined, currentTimezone));
    } else if (direction === 'prev') {
      setCurrentDate(currentDate.subtract(1, 'day'));
    } else {
      setCurrentDate(currentDate.add(1, 'day'));
    }
  };

  const formatDate = (date: dayjs.Dayjs) => {
    const today = dayjs.tz(undefined, currentTimezone);
    if (date.isSame(today, 'day')) {
      return 'Today';
    }
    return date.format('ddd, MMM D');
  };

  const formatDateFull = (date: dayjs.Dayjs) => {
    return date.format('ddd, MMM D, YYYY');
  };

  const handleAddEvent = () => {
    router.push({
      pathname: '/(app)/event-editor',
      params: { date: currentDate.format('YYYY-MM-DD') },
    });
  };

  const handleJumpToNow = () => {
    const now = dayjs.tz(undefined, currentTimezone);
    const hour = now.hour();
    const minute = now.minute();
    const minutesFromStart = (hour - dayStartHour) * 60 + minute;
    const scrollPosition = minutesFromStart * PX_PER_MIN - 100; // Offset for visibility

    verticalScrollRef.current?.scrollTo({
      y: Math.max(0, scrollPosition),
      animated: true,
    });
  };

  const handleEmptyAreaPress = (profileId: string, timeMinutes: number) => {
    // Calculate hour and minute from timeMinutes (which is relative to dayStartHour)
    const totalMinutes = timeMinutes;
    const hour = Math.floor(totalMinutes / 60) + dayStartHour;
    const minute = totalMinutes % 60;
    // Snap to 30-min increments
    const snappedMinute = Math.floor(minute / 30) * 30;
    const endTotalMinutes = totalMinutes + 30;
    const endHour = Math.floor(endTotalMinutes / 60) + dayStartHour;
    const endMinute = endTotalMinutes % 60;

    router.push({
      pathname: '/(app)/event-editor',
      params: {
        date: currentDate.format('YYYY-MM-DD'),
        userId: profileId,
        startHour: hour.toString(),
        startMinute: snappedMinute.toString(),
        endHour: endHour.toString(),
        endMinute: endMinute.toString(),
      },
    });
  };

  // Compute Now Summary
  const now = dayjs.tz(undefined, currentTimezone);
  const isToday = currentDate.isSame(now, 'day');
  let workingCount = 0;
  let busyCount = 0;
  let offCount = 0;

  if (isToday) {
    profiles.forEach((profile) => {
      const profileHours = weeklyHours.get(profile.id);
      const profileEvents = events.get(profile.id) || [];
      const statusInfo = computeStatusForUserAtTime(
        profile.id,
        now,
        currentTimezone,
        profileHours,
        profileEvents
      );
      if (statusInfo.status === 'working') workingCount++;
      else if (statusInfo.status === 'busy') busyCount++;
      else offCount++;
    });
  }

  const nextChange = isToday
    ? computeNextChangeAcrossStaff(currentDate, weeklyHours, events, currentTimezone)
    : null;

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    setEventModalVisible(true);
  };

  const handleEditEvent = () => {
    if (!selectedEvent) return;
    setEventModalVisible(false);
    router.push({
      pathname: '/(app)/event-editor',
      params: { eventId: selectedEvent.id },
    });
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(selectedEvent.id);
              setEventModalVisible(false);
              setSelectedEvent(null);
              loadData(); // Refresh data
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const handleEventDragEnd = async (
    event: Event,
    newStartTime: dayjs.Dayjs,
    newEndTime: dayjs.Dayjs
  ) => {
    try {
      const duration = newEndTime.diff(newStartTime, 'minute');
      const originalStart = dayjs(event.start).utc().tz(currentTimezone);
      const originalEnd = dayjs(event.end).utc().tz(currentTimezone);
      const originalDuration = originalEnd.diff(originalStart, 'minute');

      // If duration changed significantly, keep original duration
      const finalEndTime =
        Math.abs(duration - originalDuration) > 15
          ? newStartTime.add(originalDuration, 'minute')
          : newEndTime;

      // newStartTime and finalEndTime are already in currentTimezone
      // Convert to UTC ISO string for storage
      await updateEvent(event.id, {
        start: newStartTime.toISOString(),
        end: finalEndTime.toISOString(),
      });

      // Refresh data to show updated position (silent refresh)
      loadData(false);
    } catch (error: any) {
      console.error('Error updating event:', error);
      Alert.alert('Error', error.message || 'Failed to reschedule event');
      loadData(); // Refresh to show original position
    }
  };


  const handleEventLongPress = (event: Event) => {
    setSelectedEvent(event);
    setQuickActionsVisible(true);
  };

  const handleDuplicateEvent = async () => {
    if (!selectedEvent) return;

    try {
      const startTime = dayjs(selectedEvent.start).utc().tz(currentTimezone);
      const endTime = dayjs(selectedEvent.end).utc().tz(currentTimezone);
      const duration = endTime.diff(startTime, 'minute');

      // Create duplicate 30 minutes after original (or next day if at end of day)
      let newStartTime = startTime.add(30, 'minute');
      if (newStartTime.hour() >= 23) {
        // If would go past midnight, move to next day at same time
        newStartTime = startTime.add(1, 'day');
      }
      const newEndTime = newStartTime.add(duration, 'minute');

      // newStartTime and newEndTime are already in currentTimezone
      // Convert to UTC ISO string for storage
      await createEvent(
        {
          profile_id: selectedEvent.profile_id,
          title: selectedEvent.title,
          start: newStartTime.toISOString(),
          end: newEndTime.toISOString(),
          type: selectedEvent.type,
        },
        undefined
      );

      setQuickActionsVisible(false);
      setEventModalVisible(false);
      setSelectedEvent(null);
      loadData();
    } catch (error: any) {
      console.error('Error duplicating event:', error);
      Alert.alert('Error', error.message || 'Failed to duplicate event');
    }
  };

  // Generate date options for picker (today ± 60 days)
  const generateDateOptions = () => {
    const options: { value: string; display: string }[] = [];
    const today = dayjs.tz(undefined, currentTimezone);
    for (let i = -60; i <= 60; i++) {
      const d = today.add(i, 'day');
      options.push({
        value: d.format('YYYY-MM-DD'),
        display: d.format('ddd, MMM D, YYYY'),
      });
    }
    return options;
  };

  const DATE_OPTIONS = generateDateOptions();

  const getEventTypeBadgeStyle = (type: 'meeting' | 'personal' | 'leave') => {
    switch (type) {
      case 'meeting':
        return { backgroundColor: '#E3F2FD', borderColor: '#2196F3' };
      case 'personal':
        return { backgroundColor: '#F3E5F5', borderColor: '#9C27B0' };
      case 'leave':
        return { backgroundColor: '#FFF3E0', borderColor: '#FF9800' };
      default:
        return { backgroundColor: '#F5F5F5', borderColor: '#9E9E9E' };
    }
  };

  // Only show full loading screen on initial load
  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact Top Header */}
      <View style={styles.topBar}>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('prev')}
          >
            <Text style={styles.navButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setDatePickerVisible(true)}
          >
            <View style={styles.dateButtonContent}>
              <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
              {refreshing && (
                <ActivityIndicator size="small" color="#007AFF" style={styles.dateSpinner} />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('next')}
          >
            <Text style={styles.navButtonText}>{'>'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleJumpToNow}
          >
            <Text style={styles.actionButtonText}>Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/settings')}
          >
            <Text style={styles.actionButtonText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleAddEvent}
          >
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Now Summary Header */}
      {isToday && (
        <View style={styles.nowSummary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Working</Text>
              <Text style={[styles.summaryValue, styles.workingValue]}>{workingCount}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Busy</Text>
              <Text style={[styles.summaryValue, styles.busyValue]}>{busyCount}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Off</Text>
              <Text style={[styles.summaryValue, styles.offValue]}>{offCount}</Text>
            </View>
          </View>
          {nextChange && (
            <Text style={styles.nextChange}>
              Next: {nextChange.format('h:mm A')}
            </Text>
          )}
        </View>
      )}

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'timeline' && styles.toggleButtonActive]}
          onPress={() => setViewMode('timeline')}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === 'timeline' && styles.toggleButtonTextActive,
            ]}
          >
            Timeline
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'availability' && styles.toggleButtonActive]}
          onPress={() => setViewMode('availability')}
        >
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === 'availability' && styles.toggleButtonTextActive,
            ]}
          >
            Availability
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full Day Toggle (Timeline only) */}
      {viewMode === 'timeline' && (
        <View style={styles.fullDayToggle}>
          <Text style={styles.fullDayLabel}>Full Day (6:00-20:00)</Text>
          <Switch value={useFullDay} onValueChange={setUseFullDay} />
        </View>
      )}

      {/* Daily Confirmation (Staff only, Today only) - Only show if user is logged in */}
      {/* Temporarily disabled to debug white screen issue */}
      {false && !isAdmin && user?.id && currentDate.isSame(dayjs.tz(undefined, currentTimezone), 'day') && (
        <View style={styles.dailyConfirmationContainer}>
          <DailyConfirmation
            date={currentDate}
            expectedHours={(() => {
              if (!user?.id) return undefined;
              const weekday = currentDate.day();
              const userId = user.id;
              const userHours = weeklyHours.get(userId);
              if (!userHours || userHours.day_of_week !== weekday) {
                return undefined;
              }
              // TypeScript doesn't narrow correctly, but we've checked above
              const hours = userHours;
              const startMinutes = hours.start_hour * 60 + hours.start_minute;
              const endMinutes = hours.end_hour * 60 + hours.end_minute;
              return (endMinutes - startMinutes) / 60;
            })()}
            onConfirmationChange={() => {
              // Optionally refresh data
            }}
          />
          <TouchableOpacity
            style={styles.weeklyConfirmationButton}
            onPress={() => router.push('/(app)/weekly-confirmation')}
          >
            <Text style={styles.weeklyConfirmationButtonText}>
              📋 Weekly Confirmation
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Subtle refreshing indicator - top progress bar */}
      {refreshing && (
        <View style={styles.refreshingIndicator}>
          <View style={styles.refreshingBar} />
        </View>
      )}

      {/* Body: Timeline or Availability */}
      {viewMode === 'timeline' ? (
        <View style={styles.timelineWrapper}>
          {/* Sticky Header Row with Employee Names */}
          <View style={styles.stickyHeaderRow}>
            <View style={styles.timeGutterHeader}>
              <Text style={styles.timeGutterHeaderText}>Time</Text>
            </View>
            <ScrollView
              horizontal
              ref={headerScrollRef}
              style={styles.headerScrollView}
              contentContainerStyle={styles.headerScrollContent}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => {
                // Sync header scroll with timeline scroll
                const offsetX = event.nativeEvent.contentOffset.x;
                if (horizontalScrollRef.current) {
                  horizontalScrollRef.current.scrollTo({ x: offsetX, animated: false });
                }
              }}
            >
              <View style={styles.headerColumnsContainer}>
                {profiles.map((profile) => {
                  const profileEvents = events.get(profile.id) || [];
                  // Check if any events have conflicts
                  const hasConflict = profileEvents.some((event) =>
                    hasEventConflict(event, profileEvents, currentTimezone)
                  );
                  return (
                    <View key={profile.id} style={styles.headerColumn}>
                      <Text style={styles.headerName} numberOfLines={1}>
                        {profile.email.split('@')[0]}
                      </Text>
                      {hasConflict && <Text style={styles.headerConflict}>⚠️</Text>}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Scrollable Timeline Content */}
          <ScrollView
            ref={verticalScrollRef}
            style={styles.verticalScrollView}
            contentContainerStyle={[
              styles.verticalScrollContent,
              { height: totalHeight + 100 },
            ]}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            bounces={true}
          >
            <View style={[styles.timelineContainer, { height: totalHeight + 100 }]}>
              {/* Fixed TimeGutter */}
              <View style={styles.timeGutterContainer}>
                <View style={[styles.timeGutterContent, { height: totalHeight }]}>
                  <TimeGutter startHour={dayStartHour} endHour={dayEndHour} />
                  {/* Now Line Indicator */}
                  {isToday && (
                    <View
                      style={[
                        styles.nowLine,
                        {
                          top: (() => {
                            const now = dayjs.tz(undefined, currentTimezone);
                            const hour = now.hour();
                            const minute = now.minute();
                            const minutesFromStart = (hour - dayStartHour) * 60 + minute;
                            return minutesFromStart * PX_PER_MIN;
                          })(),
                        },
                      ]}
                    >
                      <View style={styles.nowLineDot} />
                      <View style={styles.nowLineBar} />
                    </View>
                  )}
                </View>
              </View>

              {/* Scrollable Employee Columns - Swipe horizontally to see all employees */}
              <View style={styles.horizontalScrollContainer}>
                {profiles.length > 1 && (
                  <View style={styles.swipeHint}>
                    <Text style={styles.swipeHintText}>← Swipe to see all employees →</Text>
                  </View>
                )}
                <ScrollView
                  horizontal
                  ref={horizontalScrollRef}
                  style={styles.columnsScrollView}
                  contentContainerStyle={styles.columnsContent}
                  showsHorizontalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  pagingEnabled={false}
                  decelerationRate="fast"
                  snapToInterval={200}
                  snapToAlignment="start"
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    // Sync timeline scroll with header scroll
                    const offsetX = event.nativeEvent.contentOffset.x;
                    if (headerScrollRef.current) {
                      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
                    }
                  }}
                >
                  <View style={styles.columnsContainer}>
                    {profiles.map((profile) => {
                      const profileHours = weeklyHours.get(profile.id);
                      const profileEvents = events.get(profile.id) || [];
                      return (
                        <EmployeeColumn
                          key={profile.id}
                          profile={profile}
                          workingHours={profileHours}
                          events={profileEvents}
                          timezone={currentTimezone}
                        onEventPress={handleEventPress}
                        onEventLongPress={handleEventLongPress}
                        onEventDragEnd={handleEventDragEnd}
                        onEmptyAreaPress={handleEmptyAreaPress}
                          dayStartHour={dayStartHour}
                          dayEndHour={dayEndHour}
                          showHeader={false}
                          getEventConflict={(event) =>
                            hasEventConflict(event, profileEvents, currentTimezone)
                          }
                        />
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        </View>
      ) : (
        /* Availability View */
        <ScrollView style={styles.availabilityView}>
          {profiles.map((profile) => {
            const profileHours = weeklyHours.get(profile.id);
            const profileEvents = events.get(profile.id) || [];
      const statusInfo = computeStatusForUserAtTime(
        profile.id,
        isToday ? now : currentDate.hour(12).minute(0),
        currentTimezone,
        profileHours,
        profileEvents
      );
      const nextBlock = getNextBlockForUser(
        profile.id,
        isToday ? now : currentDate.hour(12).minute(0),
        currentTimezone,
        profileHours,
        profileEvents
      );

            const getStatusColor = (status: UserStatus) => {
              switch (status) {
                case 'working':
                  return '#4CAF50';
                case 'busy':
                  return '#FF9800';
                case 'off':
                  return '#9E9E9E';
              }
            };

            const getStatusLabel = (status: UserStatus) => {
              switch (status) {
                case 'working':
                  return 'Working';
                case 'busy':
                  return 'Busy';
                case 'off':
                  return 'Off';
              }
            };

            return (
              <View key={profile.id} style={styles.availabilityCard}>
                <View style={styles.availabilityHeader}>
                  <Text style={styles.availabilityName}>
                    {profile.email.split('@')[0]}
                  </Text>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(statusInfo.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: getStatusColor(statusInfo.status) },
                      ]}
                    >
                      {getStatusLabel(statusInfo.status)}
                    </Text>
                  </View>
                </View>
                {profileHours && (
                  <Text style={styles.availabilityShift}>
                    Shift: {(() => {
                      const start = `${profileHours.start_hour}:${profileHours.start_minute.toString().padStart(2, '0')}`;
                      const end = `${profileHours.end_hour}:${profileHours.end_minute.toString().padStart(2, '0')}`;
                      return `${start} - ${end}`;
                    })()}
                  </Text>
                )}
                {statusInfo.currentEvent && (
                  <Text style={styles.availabilityCurrent}>
                    Now: {statusInfo.currentEvent.title}
                  </Text>
                )}
                {nextBlock && (
                  <Text style={styles.availabilityNext}>
                    Next: {nextBlock.title} at {nextBlock.time.format('h:mm A')}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <FlatList
              data={DATE_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === currentDate.format('YYYY-MM-DD');
                return (
                  <TouchableOpacity
                    style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                    onPress={() => {
                      setCurrentDate(dayjs.tz(item.value, currentTimezone));
                      setDatePickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dateOptionText,
                        isSelected && styles.dateOptionTextSelected,
                      ]}
                    >
                      {item.display}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <Button
              title="Cancel"
              onPress={() => setDatePickerVisible(false)}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Event Details Modal */}
      <Modal
        visible={eventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEventModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.eventModalContent}>
            {selectedEvent && (
              <>
                <View style={styles.eventModalHeader}>
                  <View style={[styles.eventTypeBadge, getEventTypeBadgeStyle(selectedEvent.type)]}>
                    <Text style={styles.eventTypeBadgeText}>
                      {selectedEvent.type.charAt(0).toUpperCase() + selectedEvent.type.slice(1)}
                    </Text>
                  </View>
                  {hasEventConflict(selectedEvent, events.get(selectedEvent.profile_id) || [], currentTimezone) && (
                    <View style={styles.conflictBadge}>
                      <Text style={styles.conflictBadgeText}>⚠️ Conflict</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.eventModalTitle}>{selectedEvent.title}</Text>
                <View style={styles.eventModalTimeRow}>
                  <Text style={styles.eventModalTimeLabel}>Date:</Text>
                  <Text style={styles.eventModalTime}>
                    {dayjs(selectedEvent.start).utc().tz(currentTimezone).format('ddd, MMM D, YYYY')}
                  </Text>
                </View>
                <View style={styles.eventModalTimeRow}>
                  <Text style={styles.eventModalTimeLabel}>Time:</Text>
                  <Text style={styles.eventModalTime}>
                    {dayjs(selectedEvent.start).utc().tz(currentTimezone).format('h:mm A')} -{' '}
                    {dayjs(selectedEvent.end).utc().tz(currentTimezone).format('h:mm A')}
                  </Text>
                </View>
                <View style={styles.eventModalTimeRow}>
                  <Text style={styles.eventModalTimeLabel}>Duration:</Text>
                  <Text style={styles.eventModalTime}>
                    {(() => {
                      const duration = dayjs(selectedEvent.end).utc().tz(currentTimezone).diff(
                        dayjs(selectedEvent.start).utc().tz(currentTimezone),
                        'minute'
                      );
                      if (duration < 60) return `${duration}m`;
                      const hours = Math.floor(duration / 60);
                      const mins = duration % 60;
                      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                    })()}
                  </Text>
                </View>
                <View style={styles.eventModalActions}>
                  <Button
                    title="Edit"
                    onPress={handleEditEvent}
                    style={styles.eventModalButton}
                  />
                  <Button
                    title="Duplicate"
                    onPress={() => {
                      setEventModalVisible(false);
                      handleDuplicateEvent();
                    }}
                    variant="outline"
                    style={styles.eventModalButton}
                  />
                  <Button
                    title="Delete"
                    onPress={handleDeleteEvent}
                    variant="outline"
                    style={StyleSheet.flatten([styles.eventModalButton, styles.deleteButton])}
                  />
                  <Button
                    title="Close"
                    onPress={() => {
                      setEventModalVisible(false);
                      setSelectedEvent(null);
                    }}
                    variant="outline"
                    style={styles.eventModalButton}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Quick Actions Modal (Long Press) */}
      <Modal
        visible={quickActionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickActionsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.quickActionsContent}>
            {selectedEvent && (
              <>
                <Text style={styles.quickActionsTitle}>{selectedEvent.title}</Text>
                <View style={styles.quickActionsList}>
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      setQuickActionsVisible(false);
                      handleEditEvent();
                    }}
                  >
                    <Text style={styles.quickActionIcon}>✏️</Text>
                    <Text style={styles.quickActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      setQuickActionsVisible(false);
                      handleDuplicateEvent();
                    }}
                  >
                    <Text style={styles.quickActionIcon}>📋</Text>
                    <Text style={styles.quickActionText}>Duplicate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionItem, styles.quickActionDelete]}
                    onPress={() => {
                      setQuickActionsVisible(false);
                      handleDeleteEvent();
                    }}
                  >
                    <Text style={styles.quickActionIcon}>🗑️</Text>
                    <Text style={[styles.quickActionText, styles.quickActionDeleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setQuickActionsVisible(false);
                    setSelectedEvent(null);
                  }}
                  variant="outline"
                  style={styles.quickActionsCancel}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  navButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  dateButton: {
    flex: 1,
    paddingVertical: 4,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  dateSpinner: {
    marginLeft: 4,
  },
  refreshingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'transparent',
    zIndex: 1000,
    overflow: 'hidden',
  },
  refreshingBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    width: '30%',
    opacity: 0.8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
  },
  dateOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dateOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  dateOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  dateOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modalButton: {
    marginTop: 16,
  },
  eventModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  eventModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  eventTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  eventTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  conflictBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFE5E5',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  conflictBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },
  eventModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#000000',
  },
  eventModalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  eventModalTimeLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  eventModalTime: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  eventModalActions: {
    marginTop: 24,
    gap: 10,
  },
  eventModalButton: {
    marginTop: 0,
  },
  deleteButton: {
    borderColor: '#FF3B30',
  },
  quickActionsContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxWidth: 300,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
  },
  quickActionsList: {
    marginBottom: 16,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  quickActionDelete: {
    backgroundColor: '#FFF5F5',
  },
  quickActionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  quickActionDeleteText: {
    color: '#FF3B30',
  },
  quickActionsCancel: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  timelineWrapper: {
    flex: 1,
  },
  stickyHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
    zIndex: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timeGutterHeader: {
    width: 80,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeGutterHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
  },
  headerScrollView: {
    flex: 1,
  },
  headerScrollContent: {
    flexDirection: 'row',
  },
  headerColumnsContainer: {
    flexDirection: 'row',
  },
  headerColumn: {
    minWidth: 200,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  headerConflict: {
    fontSize: 14,
    marginLeft: 8,
  },
  verticalScrollView: {
    flex: 1,
  },
  verticalScrollContent: {
    // Height is set explicitly in contentContainerStyle
    // Ensure content is always scrollable by adding padding
    paddingBottom: 100,
  },
  timelineContainer: {
    flexDirection: 'row',
  },
  timeGutterContainer: {
    width: 80,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  timeGutterContent: {
    width: '100%',
  },
  horizontalScrollContainer: {
    flex: 1,
    position: 'relative',
  },
  swipeHint: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  swipeHintText: {
    fontSize: 11,
    color: '#007AFF',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '500',
  },
  columnsScrollView: {
    flex: 1,
  },
  columnsContent: {
    height: '100%',
  },
  columnsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nowSummary: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  workingValue: {
    color: '#4CAF50',
  },
  busyValue: {
    color: '#FF9800',
  },
  offValue: {
    color: '#9E9E9E',
  },
  nextChange: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  fullDayToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  fullDayLabel: {
    fontSize: 14,
    color: '#000000',
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowLineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 4,
  },
  nowLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#FF3B30',
  },
  availabilityView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  availabilityCard: {
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  availabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availabilityShift: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  availabilityCurrent: {
    fontSize: 14,
    color: '#000000',
    marginTop: 8,
    fontWeight: '500',
  },
  availabilityNext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  dailyConfirmationContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  weeklyConfirmationButton: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  weeklyConfirmationButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
});
