import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useAuth } from '../../src/hooks/useAuth';
import {
  getPayrollConfirmationsForWeek,
  upsertPayrollConfirmation,
} from '../../src/data/payroll';
import { getWeeklyHoursForUser } from '../../src/data/schedule';
import { PayrollConfirmation, WeeklyHours } from '../../src/types';
import { Button } from '../../src/components/ui/Button';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAYS = [
  { name: 'Monday', index: 1 },
  { name: 'Tuesday', index: 2 },
  { name: 'Wednesday', index: 3 },
  { name: 'Thursday', index: 4 },
  { name: 'Friday', index: 5 },
  { name: 'Saturday', index: 6 },
  { name: 'Sunday', index: 0 },
];

type DayConfirmation = {
  date: string;
  dayName: string;
  confirmed: boolean;
  hours: string;
  expectedHours: number;
  notes: string;
  confirmationId?: string;
};

export default function WeeklyConfirmationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = dayjs();
    const monday = today.startOf('week').add(1, 'day'); // Monday
    return monday;
  });
  const [days, setDays] = useState<DayConfirmation[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTimezone, setCurrentTimezone] = useState<string>(getDefaultTimezone());

  useEffect(() => {
    loadTimezone();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id, currentWeekStart]);

  const loadTimezone = async () => {
    try {
      const tz = await getTimezone();
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Load weekly hours
      const hours = await getWeeklyHoursForUser(user.id);
      setWeeklyHours(hours);

      // Calculate week dates
      const weekDates: DayConfirmation[] = [];
      for (let i = 0; i < 7; i++) {
        const date = currentWeekStart.add(i, 'day');
        const weekday = date.day();
        const dayName = WEEKDAYS.find((d) => d.index === weekday)?.name || 'Unknown';
        const dateISO = date.format('YYYY-MM-DD');

        // Calculate expected hours for this day
        const dayHours = hours.find((h) => h.day_of_week === weekday);
        let expectedHours = 0;
        if (dayHours) {
          const startMinutes = dayHours.start_hour * 60 + dayHours.start_minute;
          const endMinutes = dayHours.end_hour * 60 + dayHours.end_minute;
          expectedHours = (endMinutes - startMinutes) / 60;
        }

        weekDates.push({
          date: dateISO,
          dayName,
          confirmed: false,
          hours: expectedHours > 0 ? expectedHours.toFixed(1) : '0',
          expectedHours,
          notes: '',
        });
      }

      // Load existing confirmations
      const weekStartISO = currentWeekStart.format('YYYY-MM-DD');
      const confirmations = await getPayrollConfirmationsForWeek(user.id, weekStartISO);

      // Merge confirmations with week dates
      confirmations.forEach((conf) => {
        const dayIndex = weekDates.findIndex((d) => d.date === conf.date);
        if (dayIndex >= 0) {
          weekDates[dayIndex].confirmed = true;
          weekDates[dayIndex].hours = conf.confirmed_hours.toString();
          weekDates[dayIndex].notes = conf.notes || '';
          weekDates[dayIndex].confirmationId = conf.id;
        }
      });

      setDays(weekDates);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load weekly confirmation data');
    } finally {
      setLoading(false);
    }
  };

  const updateDay = (index: number, updates: Partial<DayConfirmation>) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], ...updates };
    setDays(newDays);
  };

  const toggleDayConfirmation = (index: number) => {
    const day = days[index];
    updateDay(index, { confirmed: !day.confirmed });
  };

  const handleSaveDay = async (index: number) => {
    if (!user?.id) return;

    const day = days[index];
    const hoursNum = parseFloat(day.hours);
    if (isNaN(hoursNum) || hoursNum < 0) {
      Alert.alert('Invalid Hours', 'Please enter a valid number of hours (>= 0)');
      return;
    }

    setSaving(true);
    try {
      await upsertPayrollConfirmation({
        profile_id: user.id,
        date: day.date,
        confirmed_hours: hoursNum,
        notes: day.notes.trim() || undefined,
      });
      Alert.alert('Success', `${day.dayName} hours confirmed`);
      await loadData(); // Reload to get confirmation ID
    } catch (error: any) {
      console.error('Error saving confirmation:', error);
      Alert.alert('Error', error.message || 'Failed to save confirmation');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!user?.id) return;

    // Validate all confirmed days
    for (const day of days) {
      if (day.confirmed) {
        const hoursNum = parseFloat(day.hours);
        if (isNaN(hoursNum) || hoursNum < 0) {
          Alert.alert('Invalid Hours', `Please enter valid hours for ${day.dayName}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const promises = days
        .filter((day) => day.confirmed)
        .map((day) =>
          upsertPayrollConfirmation({
            profile_id: user.id,
            date: day.date,
            confirmed_hours: parseFloat(day.hours),
            notes: day.notes.trim() || undefined,
          })
        );

      await Promise.all(promises);
      Alert.alert('Success', 'Weekly hours confirmed successfully');
      await loadData();
    } catch (error: any) {
      console.error('Error saving confirmations:', error);
      Alert.alert('Error', error.message || 'Failed to save confirmations');
    } finally {
      setSaving(false);
    }
  };

  const handleHoursChange = (index: number, text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    updateDay(index, { hours: finalValue });
  };

  const weekEnd = currentWeekStart.add(6, 'days');
  const weekLabel = `${currentWeekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
  const totalConfirmedHours = days
    .filter((d) => d.confirmed)
    .reduce((sum, d) => sum + parseFloat(d.hours || '0'), 0);
  const totalExpectedHours = days.reduce((sum, d) => sum + d.expectedHours, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            onPress={() => setCurrentWeekStart(currentWeekStart.subtract(7, 'day'))}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity
            onPress={() => setCurrentWeekStart(currentWeekStart.add(7, 'day'))}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>Next →</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setCurrentWeekStart(dayjs().startOf('week').add(1, 'day'))}
          style={styles.todayButton}
        >
          <Text style={styles.todayButtonText}>This Week</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total Expected: {totalExpectedHours.toFixed(1)} hours
        </Text>
        <Text style={styles.summaryText}>
          Total Confirmed: {totalConfirmedHours.toFixed(1)} hours
        </Text>
      </View>

      {days.map((day, index) => (
        <View key={day.date} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <View style={styles.dayInfo}>
              <Text style={styles.dayName}>{day.dayName}</Text>
              <Text style={styles.dayDate}>{dayjs(day.date).format('MMM D')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkbox, day.confirmed && styles.checkboxChecked]}
              onPress={() => toggleDayConfirmation(index)}
            >
              {day.confirmed && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>

          {day.confirmed && (
            <View style={styles.dayContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Hours:</Text>
                <TextInput
                  style={styles.input}
                  value={day.hours}
                  onChangeText={(text) => handleHoursChange(index, text)}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                />
                {day.expectedHours > 0 && (
                  <Text style={styles.hint}>Expected: {day.expectedHours.toFixed(1)}h</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes:</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={day.notes}
                  onChangeText={(text) => updateDay(index, { notes: text })}
                  placeholder="Optional notes..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              <TouchableOpacity
                style={styles.saveDayButton}
                onPress={() => handleSaveDay(index)}
                disabled={saving}
              >
                <Text style={styles.saveDayButtonText}>Save {day.dayName}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <Button
        title={saving ? 'Saving...' : 'Confirm All Checked Days'}
        onPress={handleSaveAll}
        disabled={saving || days.filter((d) => d.confirmed).length === 0}
        style={styles.saveAllButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  weekLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  todayButton: {
    alignSelf: 'center',
    padding: 8,
  },
  todayButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  summary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  dayCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  dayDate: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayContent: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  saveDayButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveDayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveAllButton: {
    marginTop: 16,
    marginBottom: 32,
  },
});
