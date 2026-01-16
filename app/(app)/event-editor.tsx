import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, parse, getHours, getMinutes, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useAuth } from '../../src/hooks/useAuth';
import { listProfiles } from '../../src/data/profiles';
import { createEvent, updateEvent, deleteEvent } from '../../src/data/schedule';
import { Profile, Event } from '../../src/types';
import { TIME_BLOCK_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from '../../src/constants/time';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { supabase } from '../../src/lib/supabase';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';

const DEFAULT_TZ = process.env.EXPO_PUBLIC_DEFAULT_TZ || 'Australia/Sydney';

const EVENT_TYPES: Array<'meeting' | 'personal' | 'leave'> = [
  'meeting',
  'personal',
  'leave',
];

// Generate time options in 30-min increments
type TimeOption = {
  value: string;
  display: string;
  hour: number;
  minute: number;
};

function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += TIME_BLOCK_MINUTES) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      options.push({
        value: `${h}:${m}`,
        display: `${displayHour}:${m} ${period}`,
        hour,
        minute,
      });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function EventEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    eventId?: string;
    date?: string;
    userId?: string;
    startHour?: string;
    startMinute?: string;
    endHour?: string;
    endMinute?: string;
    dayOfWeek?: string; // For editing weekly schedules: 0 = Sunday, 1 = Monday, etc.
    type?: string; // Pre-select event type (meeting, personal, leave)
    isAllDay?: string; // Pre-select all-day (true/false as string)
  }>();
  const { user, isAdmin, profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [date, setDate] = useState(
    params.date || format(toZonedTime(new Date(), getDefaultTimezone()), 'yyyy-MM-dd')
  );
  const [startHour, setStartHour] = useState(
    params.startHour ? parseInt(params.startHour) : 9
  );
  const [startMinute, setStartMinute] = useState(
    params.startMinute ? parseInt(params.startMinute) : 0
  );
  const [endHour, setEndHour] = useState(
    params.endHour ? parseInt(params.endHour) : 17
  );
  const [endMinute, setEndMinute] = useState(
    params.endMinute ? parseInt(params.endMinute) : 30
  );
  const [type, setType] = useState<'meeting' | 'personal' | 'leave' | 'working_hours'>(
    (params.type as 'meeting' | 'personal' | 'leave' | 'working_hours') || 'meeting'
  );
  const [title, setTitle] = useState('');
  const [isAllDay, setIsAllDay] = useState(params.isAllDay === 'true');
  // If dayOfWeek is provided, we're editing a weekly schedule - enable recurring by default
  const [isRecurring, setIsRecurring] = useState(params.dayOfWeek !== undefined);
  const [recurringDays, setRecurringDays] = useState<Set<number>>(
    params.dayOfWeek !== undefined ? new Set([parseInt(params.dayOfWeek)]) : new Set()
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timePickerModal, setTimePickerModal] = useState<{
    visible: boolean;
    type: 'start' | 'end';
  }>({ visible: false, type: 'start' });
  const [datePickerModal, setDatePickerModal] = useState(false);
  const [userPickerModal, setUserPickerModal] = useState(false);
  const [typePickerModal, setTypePickerModal] = useState(false);
  const [currentTimezone, setCurrentTimezone] = useState<string>(getDefaultTimezone());

  // Load timezone on mount / profile timezone change
  useEffect(() => {
    loadTimezone();
  }, [profile?.timezone]);

  // Load profiles if admin
  useEffect(() => {
    if (isAdmin) {
      listProfiles()
        .then(setProfiles)
        .catch((error) => {
          console.error('Error loading profiles:', error);
          Alert.alert('Error', 'Failed to load profiles');
        });
    }
  }, [isAdmin]);

  // Set selected user
  useEffect(() => {
    if (params.userId) {
      setSelectedUserId(params.userId);
    } else if (user?.id) {
      setSelectedUserId(user.id);
    }
  }, [user?.id, params.userId]);

  const loadTimezone = async () => {
    try {
      if (profile?.timezone) {
        setCurrentTimezone(profile.timezone);
        return;
      }
      const tz = await getTimezone();
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  // Load event if editing
  useEffect(() => {
    if (params.eventId) {
      loadEvent(params.eventId);
    }
  }, [params.eventId]);

  // Reset all-day when type changes away from leave
  useEffect(() => {
    if (type !== 'leave') {
      setIsAllDay(false);
    }
  }, [type]);

  const loadEvent = async (eventId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Event not found');

      const event = data as Event;
      const tz = await getTimezone();
      const startTime = toZonedTime(new Date(event.start), tz);
      const endTime = toZonedTime(new Date(event.end), tz);

      setSelectedUserId(event.profile_id);
      setDate(format(startTime, 'yyyy-MM-dd'));
      setStartHour(getHours(startTime));
      setStartMinute(getMinutes(startTime));
      setEndHour(getHours(endTime));
      setEndMinute(getMinutes(endTime));
      setType(event.type);
      setTitle(event.title);

      // Check if all-day (spans full day)
      const isFullDay =
        getHours(startTime) === 0 &&
        getMinutes(startTime) === 0 &&
        getHours(endTime) === 23 &&
        getMinutes(endTime) === 59;
      setIsAllDay(isFullDay && event.type === 'leave');
    } catch (error: any) {
      console.error('Error loading event:', error);
      Alert.alert('Error', error.message || 'Failed to load event');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const selectedProfile = isAdmin
    ? profiles.find((p) => p.id === selectedUserId)
    : profile;

  const handleSave = async () => {
    // Validation
    if (!selectedUserId) {
      Alert.alert('Error', 'Please select a user');
      return;
    }

    if (isRecurring) {
      // Validate recurring schedule
      if (recurringDays.size === 0) {
        Alert.alert('Error', 'Please select at least one day of the week');
        return;
      }

      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (endTotal <= startTotal) {
        Alert.alert('Error', 'End time must be after start time');
        return;
      }

      setSaving(true);
      try {
        // Helper: Convert a local time in target timezone to UTC ISO string
        const timeInTimezoneToUTC = (
          y: number,
          m: number,
          d: number,
          h: number,
          min: number,
          sec: number,
          tz: string
        ): string => {
          const dateTimeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(
            2,
            '0'
          )} ${String(h).padStart(2, '0')}:${String(min).padStart(
            2,
            '0'
          )}:${String(sec).padStart(2, '0')}`;
          return fromZonedTime(dateTimeStr, tz).toISOString();
        };

        // Save as unified events (working_hours type) for selected days
        // Use a reference date (2024-01-01) for the time components
        // Convert times from user's timezone to UTC
        const referenceYear = 2024;
        const referenceMonth = 1;
        const referenceDay = 1;
        
        const startDateTime = timeInTimezoneToUTC(referenceYear, referenceMonth, referenceDay, startHour, startMinute, 0, currentTimezone);
        const endDateTime = timeInTimezoneToUTC(referenceYear, referenceMonth, referenceDay, endHour, endMinute, 0, currentTimezone);

        // Delete existing working_hours events for this user first
        const { data: existingEvents } = await supabase
          .from('events')
          .select('id')
          .eq('profile_id', selectedUserId)
          .eq('is_recurring', true)
          .eq('type', 'working_hours');

        if (existingEvents && existingEvents.length > 0) {
          const idsToDelete = existingEvents.map(e => e.id);
          await supabase
            .from('events')
            .delete()
            .in('id', idsToDelete);
        }

        // Create new events for each selected day
        const eventsToCreate = Array.from(recurringDays).map((dayOfWeek) => ({
          profile_id: selectedUserId,
          title: title.trim() || 'Working Hours',
          start: startDateTime, // Already an ISO string from timeInTimezoneToUTC
          end: endDateTime, // Already an ISO string from timeInTimezoneToUTC
          type: 'working_hours' as const,
          is_recurring: true,
          day_of_week: dayOfWeek,
          recurrence_pattern: [dayOfWeek],
          created_by: user?.id,
        }));

        // Create all events
        for (const eventData of eventsToCreate) {
          await createEvent(eventData, user?.id);
        }

        Alert.alert('Success', `Weekly schedule saved for ${recurringDays.size} day(s)`);
        router.replace('/(app)/daily');
      } catch (error: any) {
        console.error('Error saving weekly schedule:', error);
        Alert.alert('Error', error.message || 'Failed to save weekly schedule');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Regular event validation
    if (!isAllDay && !title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setSaving(true);
    try {
      let startDateTime: string;
      let endDateTime: string;

      // Parse date components
      const [year, month, day] = date.split('-').map(Number);
      
      // Helper: Convert a local time in target timezone to UTC ISO string
      // The components (y, m, d, h, min, sec) represent a time in the given timezone (tz)
      const timeInTimezoneToUTC = (
        y: number,
        m: number,
        d: number,
        h: number,
        min: number,
        sec: number,
        tz: string
      ): string => {
        const dateTimeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(
          2,
          '0'
        )} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(
          sec
        ).padStart(2, '0')}`;
        return fromZonedTime(dateTimeStr, tz).toISOString();
      };
      
      if (isAllDay && type === 'leave') {
        // All-day leave: Store as date-only (midnight to midnight UTC for the specific date)
        // This avoids timezone confusion - the date is the same regardless of timezone
        // Parse the date string directly and create UTC dates
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Start: 00:00:00 UTC on the date
        startDateTime = `${dateStr}T00:00:00.000Z`;
        // End: 00:00:00 UTC on the next day (exclusive end, standard practice)
        // This represents the full day without timezone issues
        const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
        endDateTime = nextDay.toISOString();
      } else {
        // Validate end > start
        const startTotal = startHour * 60 + startMinute;
        const endTotal = endHour * 60 + endMinute;

        if (endTotal <= startTotal) {
          Alert.alert('Error', 'End time must be after start time');
          setSaving(false);
          return;
        }

        // Convert times in target timezone to UTC
        startDateTime = timeInTimezoneToUTC(year, month, day, startHour, startMinute, 0, currentTimezone);
        endDateTime = timeInTimezoneToUTC(year, month, day, endHour, endMinute, 0, currentTimezone);
      }

      if (params.eventId) {
        // Update existing event
        await updateEvent(params.eventId, {
          profile_id: selectedUserId,
          title: title.trim() || (isAllDay ? 'Leave' : ''),
          start: startDateTime,
          end: endDateTime,
          type,
          is_all_day: isAllDay && type === 'leave',
        });
      } else {
        // Create new event
        await createEvent(
          {
            profile_id: selectedUserId,
            title: title.trim() || (isAllDay ? 'Leave' : ''),
            start: startDateTime,
            end: endDateTime,
            type,
            is_all_day: isAllDay && type === 'leave',
          },
          user?.id
        );
      }

      // Navigate back to daily view
      router.replace('/(app)/daily');
    } catch (error: any) {
      console.error('Error saving event:', error);
      Alert.alert('Error', error.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!params.eventId) return;

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(params.eventId!);
              // Navigate back to daily view
              router.replace('/(app)/daily');
            } catch (error: any) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const selectTime = (hour: number, minute: number) => {
    if (timePickerModal.type === 'start') {
      setStartHour(hour);
      setStartMinute(minute);
    } else {
      setEndHour(hour);
      setEndMinute(minute);
    }
    setTimePickerModal({ visible: false, type: 'start' });
  };

  // Generate date options (today ± 60 days)
  const generateDateOptions = () => {
    const options: { value: string; display: string }[] = [];
    const today = toZonedTime(new Date(), currentTimezone);
    for (let i = -60; i <= 60; i++) {
      const d = addDays(today, i);
      options.push({
        value: format(d, 'yyyy-MM-dd'),
        display: format(d, 'EEE, MMM d, yyyy'),
      });
    }
    return options;
  };

  const DATE_OPTIONS = generateDateOptions();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* User selector (admin only) */}
        {isAdmin && (
          <View style={styles.field}>
            <Text style={styles.label}>User *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setUserPickerModal(true)}
            >
              <Text style={styles.pickerButtonText}>
                {selectedProfile?.email || 'Select user'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isAdmin && selectedProfile && (
          <View style={styles.field}>
            <Text style={styles.label}>User</Text>
            <Text style={styles.readOnlyText}>{selectedProfile.email}</Text>
          </View>
        )}

        {/* Date picker (only for one-time events) */}
        {!isRecurring && (
          <View style={styles.field}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setDatePickerModal(true)}
            >
              <Text style={styles.pickerButtonText}>
                {format(toZonedTime(parse(date, 'yyyy-MM-dd', new Date()), currentTimezone), 'EEE, MMM d, yyyy')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recurring Weekly toggle (only for new events) */}
        {!params.eventId && (
          <View style={styles.field}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Recurring Weekly Schedule</Text>
                <Text style={styles.hint}>Create a repeating weekly schedule instead of a one-time event</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={(value) => {
                  setIsRecurring(value);
                  if (value) {
                    // When enabling recurring, set the current day of week
                    const currentDateObj = parse(date, 'yyyy-MM-dd', new Date());
                    const currentDay = currentDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    setRecurringDays(new Set([currentDay]));
                  } else {
                    setRecurringDays(new Set());
                  }
                }}
              />
            </View>
          </View>
        )}

        {/* Recurring days selector */}
        {isRecurring && (
          <View style={styles.field}>
            <Text style={styles.label}>Days of Week *</Text>
            <View style={styles.daysContainer}>
              {[
                { label: 'Sun', value: 0 },
                { label: 'Mon', value: 1 },
                { label: 'Tue', value: 2 },
                { label: 'Wed', value: 3 },
                { label: 'Thu', value: 4 },
                { label: 'Fri', value: 5 },
                { label: 'Sat', value: 6 },
              ].map((day) => (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.dayButton,
                    recurringDays.has(day.value) && styles.dayButtonSelected,
                  ]}
                  onPress={() => {
                    const newDays = new Set(recurringDays);
                    if (newDays.has(day.value)) {
                      newDays.delete(day.value);
                    } else {
                      newDays.add(day.value);
                    }
                    setRecurringDays(newDays);
                  }}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      recurringDays.has(day.value) && styles.dayButtonTextSelected,
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* All-day toggle (only for leave, and not for recurring) */}
        {type === 'leave' && !isRecurring && (
          <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>All-day</Text>
              <Switch
                value={isAllDay}
                onValueChange={setIsAllDay}
              />
            </View>
          </View>
        )}

        {/* Start time */}
        {!isAllDay && (
          <View style={styles.field}>
            <Text style={styles.label}>Start Time *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setTimePickerModal({ visible: true, type: 'start' })}
            >
              <Text style={styles.pickerButtonText}>
                {formatTime(startHour, startMinute)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* End time */}
        {!isAllDay && (
          <View style={styles.field}>
            <Text style={styles.label}>End Time *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setTimePickerModal({ visible: true, type: 'end' })}
            >
              <Text style={styles.pickerButtonText}>
                {formatTime(endHour, endMinute)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Type picker (only for one-time events) */}
        {!isRecurring && (
          <View style={styles.field}>
            <Text style={styles.label}>Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setTypePickerModal(true)}
            >
              <Text style={styles.pickerButtonText}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Title input */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {isRecurring ? 'Schedule Name (optional)' : `Title ${!isAllDay ? '*' : ''}`}
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={
              isRecurring 
                ? "e.g., Regular Work Hours" 
                : isAllDay 
                  ? "Leave (optional)" 
                  : "Enter event title"
            }
            style={styles.input}
          />
        </View>

        <Button
          title={
            isRecurring 
              ? "Save Weekly Schedule" 
              : params.eventId 
                ? "Update Event" 
                : "Save Event"
          }
          onPress={handleSave}
          disabled={
            saving || 
            (isRecurring 
              ? recurringDays.size === 0 
              : !isAllDay && !title.trim())
          }
          style={styles.saveButton}
        />

        {/* Delete button - only show when editing existing event (not recurring) */}
        {params.eventId && !isRecurring && (
          <Button
            title="Delete Event"
            onPress={handleDelete}
            disabled={saving}
            style={[styles.deleteButton, styles.saveButton]}
          />
        )}
        
        {/* Extra padding at bottom to ensure delete button is visible */}
        {params.eventId && !isRecurring && <View style={{ height: 20 }} />}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
              <FlatList
              data={DATE_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === date;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      setDate(item.value);
                      setDatePickerModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
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
              onPress={() => setDatePickerModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePickerModal({ visible: false, type: 'start' })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select {timePickerModal.type === 'start' ? 'Start' : 'End'} Time
            </Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => selectTime(item.hour, item.minute)}
                >
                  <Text style={styles.optionText}>{item.display}</Text>
                </TouchableOpacity>
              )}
            />
            <Button
              title="Cancel"
              onPress={() => setTimePickerModal({ visible: false, type: 'start' })}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {/* User Picker Modal (admin only) */}
      {isAdmin && (
        <Modal
          visible={userPickerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setUserPickerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select User</Text>
              <FlatList
                data={profiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => {
                      setSelectedUserId(item.id);
                      setUserPickerModal(false);
                    }}
                  >
                    <Text style={styles.optionText}>{item.email}</Text>
                  </TouchableOpacity>
                )}
              />
              <Button
                title="Cancel"
                onPress={() => setUserPickerModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Type Picker Modal */}
      <Modal
        visible={typePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setTypePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Type</Text>
            <FlatList
              data={EVENT_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    setType(item);
                    setTypePickerModal(false);
                  }}
                >
                  <Text style={styles.optionText}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <Button
              title="Cancel"
              onPress={() => setTypePickerModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32, // Extra padding to ensure delete button is visible
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  pickerButton: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666666',
    padding: 12,
  },
  input: {
    marginTop: 0,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  hint: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    minWidth: 50,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
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
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  optionText: {
    fontSize: 16,
    color: '#000000',
  },
  optionSelected: {
    backgroundColor: '#E3F2FD',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modalButton: {
    marginTop: 16,
  },
});
