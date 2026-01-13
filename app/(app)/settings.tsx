import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { COMPANY_DOMAIN } from '../../src/constants/company';
import { Button } from '../../src/components/ui/Button';
import { getTimezone, setTimezone, COMMON_TIMEZONES, getDefaultTimezone } from '../../src/utils/timezone';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getDefaultTimezone());
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [loadingTimezone, setLoadingTimezone] = useState(true);

  useEffect(() => {
    loadTimezone();
  }, []);

  const loadTimezone = async () => {
    try {
      const tz = await getTimezone();
      setSelectedTimezone(tz);
    } catch (error) {
      console.error('Error loading timezone:', error);
    } finally {
      setLoadingTimezone(false);
    }
  };

  const handleTimezoneChange = async (timezone: string) => {
    try {
      await setTimezone(timezone);
      setSelectedTimezone(timezone);
      setTimezonePickerVisible(false);
      Alert.alert('Success', 'Timezone updated. Please refresh the calendar view.');
    } catch (error: any) {
      console.error('Error setting timezone:', error);
      Alert.alert('Error', 'Failed to update timezone');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Navigation will be handled by the auth gating in _layout.tsx
            } catch (error: any) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user?.email || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Role:</Text>
          <Text style={styles.value}>
            {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Company Domain:</Text>
          <Text style={styles.value}>{COMPANY_DOMAIN || 'Not set'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timezone Settings</Text>
        <TouchableOpacity
          style={[styles.infoRow, styles.timezoneRowHighlight]}
          onPress={() => setTimezonePickerVisible(true)}
        >
          <View style={styles.timezoneInfo}>
            <Text style={styles.timezoneLabel}>Current Timezone</Text>
            <Text style={styles.timezoneValue}>
              {loadingTimezone
                ? 'Loading...'
                : COMMON_TIMEZONES.find((tz) => tz.value === selectedTimezone)?.label ||
                  selectedTimezone}
            </Text>
          </View>
          <Text style={styles.changeText}>Tap to Change →</Text>
        </TouchableOpacity>
        <Text style={styles.timezoneHint}>
          All times in the calendar will be displayed in your selected timezone.
        </Text>
      </View>

      <View style={styles.section}>
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </View>

      {/* Timezone Picker Modal */}
      <Modal
        visible={timezonePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Timezone</Text>
            <FlatList
              data={COMMON_TIMEZONES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === selectedTimezone;
                return (
                  <TouchableOpacity
                    style={[styles.timezoneOption, isSelected && styles.timezoneOptionSelected]}
                    onPress={() => handleTimezoneChange(item.value)}
                  >
                    <Text
                      style={[
                        styles.timezoneOptionText,
                        isSelected && styles.timezoneOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            <Button
              title="Cancel"
              onPress={() => setTimezonePickerVisible(false)}
              variant="outline"
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 16,
    color: '#666666',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  logoutButton: {
    marginTop: 8,
  },
  timezoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timezoneRowHighlight: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timezoneInfo: {
    flex: 1,
  },
  timezoneLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  timezoneValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  changeText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  timezoneHint: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    paddingHorizontal: 4,
    fontStyle: 'italic',
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
  timezoneOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timezoneOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  timezoneOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  timezoneOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalButton: {
    marginTop: 16,
  },
});
