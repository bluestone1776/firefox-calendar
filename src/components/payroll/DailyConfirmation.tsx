import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
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
  const [showDetails, setShowDetails] = useState(false);

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
        setShowDetails(false);
      } else {
        setIsConfirmed(false);
        setHours(expectedHours?.toString() || '8.0');
        setNotes('');
        setShowDetails(false);
      }
    } catch (error: any) {
      // Silently handle errors - table might not exist yet
      console.warn('Error loading confirmation (table may not exist):', error);
      setIsConfirmed(false);
      setHours(expectedHours?.toString() || '8.0');
      setNotes('');
      setShowDetails(false);
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
      setShowDetails(false);
    } else {
      // Delete confirmation
      if (confirmation?.id) {
        setSaving(true);
        try {
          await deletePayrollConfirmation(confirmation.id);
          setConfirmation(null);
          setHours(expectedHours?.toString() || '8.0');
          setNotes('');
          setShowDetails(false);
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
  const parsedHours = Number.parseFloat(hours);
  const hasHoursValue = Number.isFinite(parsedHours);
  const deltaHours =
    expectedHours !== undefined && hasHoursValue ? parsedHours - expectedHours : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>
            {isToday ? 'Confirm Hours Worked Today' : `Confirm Hours for ${format(date, 'MMM d')}`}
          </Text>
          <Text style={styles.subtitle}>Daily payroll confirmation</Text>
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{isConfirmed ? 'Confirmed' : 'Not confirmed'}</Text>
          <Switch
            value={isConfirmed}
            onValueChange={(checked) => {
              if (!saving) {
                handleToggle(checked);
              }
            }}
            disabled={saving}
          />
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowDetails((prev) => !prev)}
            disabled={saving}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails
                ? 'Hide details'
                : isConfirmed
                ? 'Edit details'
                : 'Add details'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.pill, isConfirmed ? styles.pillConfirmed : styles.pillPending]}>
          <Text style={styles.pillText}>{isConfirmed ? 'Confirmed' : 'Pending'}</Text>
        </View>
        {expectedHours !== undefined && (
          <View style={styles.pill}>
            <Text style={styles.pillTextMuted}>
              Expected {expectedHours.toFixed(1)}h
            </Text>
          </View>
        )}
        {isConfirmed && deltaHours !== null && (
          <View
            style={[
              styles.pill,
              deltaHours >= 0 ? styles.pillPositive : styles.pillNegative,
            ]}
          >
            <Text style={styles.pillText}>
              {deltaHours >= 0 ? '+' : '-'}
              {Math.abs(deltaHours).toFixed(1)}h
            </Text>
          </View>
        )}
      </View>

      {showDetails && (
        <View style={styles.content}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hours worked</Text>
            <View style={styles.hoursInputRow}>
              <TextInput
                style={[styles.input, styles.hoursInput]}
                value={hours}
                onChangeText={handleHoursChange}
                keyboardType="decimal-pad"
                placeholder="8.0"
                editable={!saving}
              />
              <Text style={styles.hoursSuffix}>hrs</Text>
            </View>
            {expectedHours !== undefined && (
              <Text style={styles.hint}>
                Expected: {expectedHours.toFixed(1)} hours
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  toggleRow: {
    alignItems: 'flex-end',
  },
  detailsToggle: {
    paddingVertical: 4,
  },
  detailsToggleText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillConfirmed: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A7F3D0',
  },
  pillPending: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  pillPositive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A7F3D0',
  },
  pillNegative: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  pillTextMuted: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#374151',
    marginBottom: 8,
  },
  hoursInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  hoursInput: {
    flex: 1,
  },
  hoursSuffix: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
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
