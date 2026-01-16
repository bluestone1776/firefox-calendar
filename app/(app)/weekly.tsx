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
  Switch,
} from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { listProfiles, getMyProfile } from '../../src/data/profiles';
import {
  getWeeklyHoursForUser,
  upsertWeeklyHours,
} from '../../src/data/schedule';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';
import { Profile, WeeklyHours } from '../../src/types';
import { TIME_BLOCK_MINUTES, DAY_START_HOUR, DAY_END_HOUR } from '../../src/constants/time';
import { Button } from '../../src/components/ui/Button';

const WEEKDAYS = [
  { name: 'Monday', index: 1 },
  { name: 'Tuesday', index: 2 },
  { name: 'Wednesday', index: 3 },
  { name: 'Thursday', index: 4 },
  { name: 'Friday', index: 5 },
  { name: 'Saturday', index: 6 },
  { name: 'Sunday', index: 0 },
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

type DayHours = {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export default function WeeklyScreen() {
  const { user, isAdmin, profile } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<Record<number, DayHours>>({
    0: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    1: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    2: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    3: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    4: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    5: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
    6: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
  });
  const [timePickerModal, setTimePickerModal] = useState<{
    visible: boolean;
    day: number;
    type: 'start' | 'end';
  }>({ visible: false, day: 0, type: 'start' });

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
    if (isAdmin && selectedUserId) {
      loadHours(selectedUserId);
    } else if (user?.id) {
      setSelectedUserId(user.id);
      loadHours(user.id);
    }
  }, [isAdmin, user?.id]);

  // Load hours when selected user changes
  useEffect(() => {
    if (selectedUserId) {
      loadHours(selectedUserId);
    }
  }, [selectedUserId]);

  const loadHours = async (userId: string) => {
    setLoading(true);
    try {
      // Load timezone
      const selectedProfile = profiles.find((p) => p.id === userId);
      const timezone =
        selectedProfile?.timezone ||
        profile?.timezone ||
        (await getTimezone().catch(() => getDefaultTimezone()));
      // Load weekly hours (convert from UTC to user's timezone)
      const existingHours = await getWeeklyHoursForUser(userId, timezone);
      const newHours: Record<number, DayHours> = {
        0: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        1: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        2: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        3: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        4: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        5: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
        6: { enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 },
      };

      existingHours.forEach((h) => {
        newHours[h.day_of_week] = {
          enabled: true,
          startHour: h.start_hour,
          startMinute: h.start_minute,
          endHour: h.end_hour,
          endMinute: h.end_minute,
        };
      });

      setHours(newHours);
    } catch (error: any) {
      console.error('Error loading hours:', error);
      Alert.alert('Error', error.message || 'Failed to load weekly hours');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      const rows = Object.entries(hours)
        .filter(([_, dayHours]) => dayHours.enabled)
        .map(([day, dayHours]) => ({
          profile_id: selectedUserId,
          day_of_week: parseInt(day),
          start_hour: dayHours.startHour,
          start_minute: dayHours.startMinute,
          end_hour: dayHours.endHour,
          end_minute: dayHours.endMinute,
        }));

      await upsertWeeklyHours(selectedUserId, rows);
      Alert.alert('Success', 'Weekly hours saved successfully');
    } catch (error: any) {
      console.error('Error saving hours:', error);
      Alert.alert('Error', error.message || 'Failed to save weekly hours');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const openTimePicker = (day: number, type: 'start' | 'end') => {
    setTimePickerModal({ visible: true, day, type });
  };

  const selectTime = (hour: number, minute: number) => {
    const day = hours[timePickerModal.day];
    if (timePickerModal.type === 'start') {
      setHours({
        ...hours,
        [timePickerModal.day]: {
          ...day,
          startHour: hour,
          startMinute: minute,
        },
      });
    } else {
      setHours({
        ...hours,
        [timePickerModal.day]: {
          ...day,
          endHour: hour,
          endMinute: minute,
        },
      });
    }
    setTimePickerModal({ visible: false, day: 0, type: 'start' });
  };

  const selectedProfile = isAdmin
    ? profiles.find((p) => p.id === selectedUserId)
    : profile;

  if (loading && !selectedUserId) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header with staff picker for admin */}
        {isAdmin && (
          <View style={styles.header}>
            <Text style={styles.label}>Select Staff Member:</Text>
            <View style={styles.pickerContainer}>
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.pickerOption,
                    selectedUserId === p.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setSelectedUserId(p.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedUserId === p.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {p.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!isAdmin && selectedProfile && (
          <View style={styles.header}>
            <Text style={styles.userEmail}>{selectedProfile.email}</Text>
          </View>
        )}

        {/* Copy Monday to Weekdays button */}
        <View style={styles.copyButtonContainer}>
          <Button
            title="Copy Mon to Weekdays"
            onPress={() => {
              const mondayHours = hours[1];
              if (mondayHours && mondayHours.enabled) {
                const newHours = { ...hours };
                [2, 3, 4, 5].forEach((dayIndex) => {
                  newHours[dayIndex] = {
                    ...mondayHours,
                  };
                });
                setHours(newHours);
              } else {
                Alert.alert('Info', 'Please enable Monday hours first');
              }
            }}
            variant="outline"
            style={styles.copyButton}
          />
        </View>

        {/* Weekly hours for each day */}
        {WEEKDAYS.map((day) => {
          const dayHours = hours[day.index];
          return (
            <View key={day.index} style={styles.dayRow}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{day.name}</Text>
                <Switch
                  value={dayHours.enabled}
                  onValueChange={(enabled) =>
                    setHours({
                      ...hours,
                      [day.index]: { ...dayHours, enabled },
                    })
                  }
                />
              </View>

              {dayHours.enabled && (
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePicker(day.index, 'start')}
                  >
                    <Text style={styles.timeButtonText}>
                      Start: {formatTime(dayHours.startHour, dayHours.startMinute)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePicker(day.index, 'end')}
                  >
                    <Text style={styles.timeButtonText}>
                      End: {formatTime(dayHours.endHour, dayHours.endMinute)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <Button
          title="Save Weekly Hours"
          onPress={handleSave}
          disabled={saving || !selectedUserId}
          style={styles.saveButton}
        />
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setTimePickerModal({ visible: false, day: 0, type: 'start' })
        }
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
                  style={styles.timeOption}
                  onPress={() => selectTime(item.hour, item.minute)}
                >
                  <Text style={styles.timeOptionText}>{item.display}</Text>
                </TouchableOpacity>
              )}
            />
            <Button
              title="Cancel"
              onPress={() =>
                setTimePickerModal({ visible: false, day: 0, type: 'start' })
              }
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
  header: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  copyButtonContainer: {
    marginBottom: 16,
  },
  copyButton: {
    marginTop: 0,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#000000',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
  },
  dayRow: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#000000',
  },
  saveButton: {
    marginTop: 24,
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
  timeOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  modalButton: {
    marginTop: 16,
  },
});
