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
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useAuth } from '../../src/hooks/useAuth';
import { listProfiles } from '../../src/data/profiles';
import { createEvent, updateEvent } from '../../src/data/schedule';
import { Profile, Event } from '../../src/types';
import { TIME_BLOCK_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from '../../src/constants/time';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { supabase } from '../../src/lib/supabase';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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
  }>();
  const { user, isAdmin, profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [date, setDate] = useState(
    params.date || dayjs.tz(undefined, getDefaultTimezone()).format('YYYY-MM-DD')
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
  const [type, setType] = useState<'meeting' | 'personal' | 'leave'>('meeting');
  const [title, setTitle] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
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

  // Load timezone on mount
  useEffect(() => {
    loadTimezone();
  }, []);

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
      const startTime = dayjs.tz(event.start, tz);
      const endTime = dayjs.tz(event.end, tz);

      setSelectedUserId(event.profile_id);
      setDate(startTime.format('YYYY-MM-DD'));
      setStartHour(startTime.hour());
      setStartMinute(startTime.minute());
      setEndHour(endTime.hour());
      setEndMinute(endTime.minute());
      setType(event.type);
      setTitle(event.title);

      // Check if all-day (spans full day)
      const isFullDay =
        startTime.hour() === 0 &&
        startTime.minute() === 0 &&
        endTime.hour() === 23 &&
        endTime.minute() === 59;
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
    if (!isAllDay && !title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    if (!selectedUserId) {
      Alert.alert('Error', 'Please select a user');
      return;
    }

    setSaving(true);
    try {
      let startDateTime: string;
      let endDateTime: string;

      if (isAllDay && type === 'leave') {
        // All-day leave: 00:00 to 23:59 in the selected timezone
        // Use format to ensure correct timezone interpretation
        const startDate = dayjs.tz(`${date} 00:00:00`, currentTimezone);
        const endDate = dayjs.tz(`${date} 23:59:59`, currentTimezone);
        startDateTime = startDate.toISOString();
        endDateTime = endDate.toISOString();
      } else {
        // Validate end > start
        const startTotal = startHour * 60 + startMinute;
        const endTotal = endHour * 60 + endMinute;

        if (endTotal <= startTotal) {
          Alert.alert('Error', 'End time must be after start time');
          setSaving(false);
          return;
        }

        // Create date-time string in format "YYYY-MM-DD HH:mm:ss" and parse in timezone
        // This ensures the time is interpreted in the correct timezone
        const startTimeStr = `${date} ${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00`;
        const endTimeStr = `${date} ${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`;
        
        const startDate = dayjs.tz(startTimeStr, 'YYYY-MM-DD HH:mm:ss', currentTimezone);
        const endDate = dayjs.tz(endTimeStr, 'YYYY-MM-DD HH:mm:ss', currentTimezone);
        
        startDateTime = startDate.toISOString();
        endDateTime = endDate.toISOString();
      }

      if (params.eventId) {
        // Update existing event
        await updateEvent(params.eventId, {
          profile_id: selectedUserId,
          title: title.trim() || (isAllDay ? 'Leave' : ''),
          start: startDateTime,
          end: endDateTime,
          type,
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

        {/* Date picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setDatePickerModal(true)}
          >
            <Text style={styles.pickerButtonText}>
              {dayjs.tz(date, currentTimezone).format('ddd, MMM D, YYYY')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* All-day toggle (only for leave) */}
        {type === 'leave' && (
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

        {/* Type picker */}
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

        {/* Title input */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Title {!isAllDay ? '*' : ''}
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={isAllDay ? "Leave (optional)" : "Enter event title"}
            style={styles.input}
          />
        </View>

        <Button
          title={params.eventId ? "Update Event" : "Save Event"}
          onPress={handleSave}
          disabled={saving || (!isAllDay && !title.trim())}
          style={styles.saveButton}
        />
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
  saveButton: {
    marginTop: 8,
    marginBottom: 32,
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
