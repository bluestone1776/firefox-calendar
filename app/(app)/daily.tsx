import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { listProfiles } from '../../src/data/profiles';
import {
  getWeeklyHoursForWeekday,
  getEventsForDate,
} from '../../src/data/schedule';
import { Profile, WeeklyHours, Event } from '../../src/types';
import { DAY_START_HOUR, DAY_END_HOUR, PX_PER_MIN } from '../../src/constants/time';
import { TimeGutter } from '../../src/components/timeline/TimeGutter';
import { EmployeeColumn } from '../../src/components/timeline/EmployeeColumn';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = process.env.EXPO_PUBLIC_DEFAULT_TZ || 'Australia/Sydney';

export default function DailyScreen() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(dayjs.tz(undefined, DEFAULT_TZ));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<Map<string, WeeklyHours>>(
    new Map()
  );
  const [events, setEvents] = useState<Map<string, Event[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const verticalScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Calculate total timeline height
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const totalHeight = totalMinutes * PX_PER_MIN;

  // Load data for current date
  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get weekday (0 = Sunday, 1 = Monday, etc.)
      const weekday = currentDate.day();

      // Get date in ISO format (YYYY-MM-DD) in the target timezone
      const dateISO = currentDate.format('YYYY-MM-DD');

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
      const eventsData = await getEventsForDate(dateISO, DEFAULT_TZ);
      const eventsMap = new Map<string, Event[]>();
      eventsData.forEach((event) => {
        const existing = eventsMap.get(event.profile_id) || [];
        eventsMap.set(event.profile_id, [...existing, event]);
      });
      setEvents(eventsMap);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(dayjs.tz(undefined, DEFAULT_TZ));
    } else if (direction === 'prev') {
      setCurrentDate(currentDate.subtract(1, 'day'));
    } else {
      setCurrentDate(currentDate.add(1, 'day'));
    }
  };

  const formatDate = (date: dayjs.Dayjs) => {
    return date.format('ddd, MMM D, YYYY');
  };

  const handleAddEvent = () => {
    router.push('/(app)/event-editor');
  };

  const handleWeekly = () => {
    router.push('/(app)/weekly');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.dateNavigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('prev')}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('today')}
          >
            <Text style={styles.navButtonText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDate('next')}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleWeekly}
          >
            <Text style={styles.actionButtonText}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleAddEvent}
          >
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Add Event
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body: Timeline */}
      <ScrollView
        ref={verticalScrollRef}
        style={styles.verticalScrollView}
        contentContainerStyle={[
          styles.verticalScrollContent,
          { height: totalHeight },
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.timelineContainer}>
          {/* Fixed TimeGutter */}
          <View style={styles.timeGutterContainer}>
            <View style={[styles.timeGutterContent, { height: totalHeight }]}>
              <TimeGutter />
            </View>
          </View>

          {/* Scrollable Employee Columns */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            style={styles.columnsScrollView}
            contentContainerStyle={styles.columnsContent}
            showsHorizontalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View style={[styles.columnsContainer, { height: totalHeight }]}>
              {profiles.map((profile) => {
                const profileHours = weeklyHours.get(profile.id);
                const profileEvents = events.get(profile.id) || [];
                return (
                  <EmployeeColumn
                    key={profile.id}
                    profile={profile}
                    workingHours={profileHours}
                    events={profileEvents}
                    timezone={DEFAULT_TZ}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  navButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  verticalScrollView: {
    flex: 1,
  },
  verticalScrollContent: {
    flexGrow: 1,
  },
  timelineContainer: {
    flexDirection: 'row',
    height: '100%',
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
  columnsScrollView: {
    flex: 1,
  },
  columnsContent: {
    height: '100%',
  },
  columnsContainer: {
    flexDirection: 'row',
    height: '100%',
  },
});
