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
} from 'react-native';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { useAuth } from '../../src/hooks/useAuth';
import { listProfiles } from '../../src/data/profiles';
import { createEvent } from '../../src/data/schedule';
import { Profile } from '../../src/types';
import { TIME_BLOCK_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from '../../src/constants/time';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';

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
  const { user, isAdmin, profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(17);
  const [endMinute, setEndMinute] = useState(0);
  const [type, setType] = useState<'meeting' | 'personal' | 'leave'>('meeting');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [timePickerModal, setTimePickerModal] = useState<{
    visible: boolean;
    type: 'start' | 'end';
  }>({ visible: false, type: 'start' });
  const [datePickerModal, setDatePickerModal] = useState(false);
  const [userPickerModal, setUserPickerModal] = useState(false);
  const [typePickerModal, setTypePickerModal] = useState(false);

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
    if (user?.id) {
      setSelectedUserId(user.id);
    }
  }, [user?.id]);

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
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    if (!selectedUserId) {
      Alert.alert('Error', 'Please select a user');
      return;
    }

    // Validate end > start
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    if (endTotal <= startTotal) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    setSaving(true);
    try {
      // Build ISO datetime strings
      const startDateTime = dayjs(`${date} ${startHour}:${startMinute}`, 'YYYY-MM-DD H:mm').toISOString();
      const endDateTime = dayjs(`${date} ${endHour}:${endMinute}`, 'YYYY-MM-DD H:mm').toISOString();

      await createEvent(
        {
          profile_id: selectedUserId,
          title: title.trim(),
          start: startDateTime,
          end: endDateTime,
          type,
        },
        user?.id
      );

      router.back();
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

  // Generate date options (today and next 30 days)
  const generateDateOptions = () => {
    const options: { value: string; display: string }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = dayjs().add(i, 'day');
      options.push({
        value: d.format('YYYY-MM-DD'),
        display: d.format('ddd, MMM D, YYYY'),
      });
    }
    return options;
  };

  const DATE_OPTIONS = generateDateOptions();

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
              {dayjs(date).format('ddd, MMM D, YYYY')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Start time */}
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

        {/* End time */}
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
          <Text style={styles.label}>Title *</Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Enter event title"
            style={styles.input}
          />
        </View>

        <Button
          title="Save Event"
          onPress={handleSave}
          disabled={saving || !title.trim()}
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    setDate(item.value);
                    setDatePickerModal(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.display}</Text>
                </TouchableOpacity>
              )}
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
  modalButton: {
    marginTop: 16,
  },
});
