import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { format, isSameDay } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import {
  getPayrollConfirmation,
  upsertPayrollConfirmation,
  deletePayrollConfirmation,
} from '../../data/payroll';
import { PayrollConfirmation as PayrollConfirmationType } from '../../types';

interface DailyConfirmationProps {
  date: Date;
  expectedHours?: number; // Optional: calculated expected hours based on schedule
  onConfirmationChange?: () => void;
}

export function DailyConfirmation({
  date,
  expectedHours,
  onConfirmationChange,
}: DailyConfirmationProps) {
  const { user } = useAuth();
  const [confirmation, setConfirmation] = useState<PayrollConfirmationType | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [hours, setHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dateISO = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (user?.id) {
      loadConfirmation();
    }
  }, [user?.id, dateISO]);

  const loadConfirmation = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await getPayrollConfirmation(user.id, dateISO);
      if (data) {
        setConfirmation(data);
        setIsConfirmed(true);
        setHours(data.confirmed_hours.toString());
        setNotes(data.notes || '');
      } else {
        setIsConfirmed(false);
        setHours(expectedHours?.toString() || '8.0');
        setNotes('');
      }
    } catch (error: any) {
      // Silently handle errors - table might not exist yet
      console.warn('Error loading confirmation (table may not exist):', error);
      setIsConfirmed(false);
      setHours(expectedHours?.toString() || '8.0');
      setNotes('');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (!user?.id) return;

    setIsConfirmed(checked);

    if (checked) {
      // Save confirmation
      await saveConfirmation();
    } else {
      // Delete confirmation
      if (confirmation?.id) {
        setSaving(true);
        try {
          await deletePayrollConfirmation(confirmation.id);
          setConfirmation(null);
          setHours(expectedHours?.toString() || '8.0');
          setNotes('');
          onConfirmationChange?.();
        } catch (error: any) {
          console.error('Error deleting confirmation:', error);
          Alert.alert('Error', 'Failed to delete confirmation');
          setIsConfirmed(true); // Revert toggle
        } finally {
          setSaving(false);
        }
      }
    }
  };

  const saveConfirmation = async () => {
    if (!user?.id) return;

    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum < 0) {
      Alert.alert('Invalid Hours', 'Please enter a valid number of hours (>= 0)');
      return;
    }

    setSaving(true);
    try {
      const data = await upsertPayrollConfirmation({
        profile_id: user.id,
        date: dateISO,
        confirmed_hours: hoursNum,
        notes: notes.trim() || undefined,
      });
      setConfirmation(data);
      onConfirmationChange?.();
    } catch (error: any) {
      console.error('Error saving confirmation:', error);
      Alert.alert('Error', error.message || 'Failed to save confirmation');
      setIsConfirmed(false); // Revert toggle on error
    } finally {
      setSaving(false);
    }
  };

  const handleHoursChange = (text: string) => {
    // Allow only numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      // More than one decimal point, keep only first
      setHours(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setHours(cleaned);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  const isToday = isSameDay(date, new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isToday ? 'Confirm Hours Worked Today' : `Confirm Hours for ${format(date, 'MMM d')}`}
        </Text>
        <TouchableOpacity
          style={[styles.checkbox, isConfirmed && styles.checkboxChecked]}
          onPress={() => !saving && handleToggle(!isConfirmed)}
          disabled={saving}
        >
          {isConfirmed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>

      {isConfirmed && (
        <View style={styles.content}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hours Worked:</Text>
            <TextInput
              style={styles.input}
              value={hours}
              onChangeText={handleHoursChange}
              keyboardType="decimal-pad"
              placeholder="8.0"
              editable={!saving}
            />
            {expectedHours !== undefined && (
              <Text style={styles.hint}>
                Expected: {expectedHours.toFixed(1)} hours
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional):</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes..."
              multiline
              numberOfLines={2}
              editable={!saving}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveConfirmation}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
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
  content: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
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
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
