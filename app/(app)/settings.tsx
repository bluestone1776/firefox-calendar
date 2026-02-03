import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Switch, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { COMPANY_DOMAIN } from '../../src/constants/company';
import { Button } from '../../src/components/ui/Button';
import { MemberManagement } from '../../src/components/MemberManagement';
import { updateProfileName } from '../../src/data/profiles';
// DISABLED: Notifications not working with Expo Go
// import {
//   requestNotificationPermissions,
//   scheduleFridayReminder,
//   scheduleDailyReminder,
//   cancelFridayReminder,
//   cancelDailyReminder,
//   getAllScheduledNotifications,
// } from '../../src/utils/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, loading, isAdmin, refreshProfile } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.name || '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    // Timezone is locked to Brisbane; no loading needed.
    // DISABLED: Notifications not working with Expo Go
    // loadNotificationStatus();
    setNewName(profile?.name || '');
  }, [profile]);

  // DISABLED: Notifications not working with Expo Go
  // const loadNotificationStatus = async () => {
  //   setLoadingNotifications(true);
  //   try {
  //     const notifications = await getAllScheduledNotifications();
  //     const hasReminders = notifications.some(
  //       (n) =>
  //         n.content.data?.type === 'weekly_confirmation_reminder' ||
  //         n.content.data?.type === 'daily_confirmation_reminder'
  //     );
  //     setNotificationsEnabled(hasReminders);
  //   } catch (error) {
  //     console.error('Error loading notification status:', error);
  //   } finally {
  //     setLoadingNotifications(false);
  //   }
  // };

  // DISABLED: Notifications not working with Expo Go
  // const handleNotificationToggle = async (enabled: boolean) => {
  //   try {
  //     if (enabled) {
  //       const hasPermission = await requestNotificationPermissions();
  //       if (!hasPermission) {
  //         Alert.alert(
  //           'Permission Required',
  //           'Please enable notifications in your device settings to receive reminders.'
  //         );
  //         return;
  //       }
  //       await scheduleFridayReminder();
  //       await scheduleDailyReminder();
  //       setNotificationsEnabled(true);
  //       Alert.alert('Success', 'Notifications enabled. You will receive reminders for weekly and daily confirmations.');
  //     } else {
  //       await cancelFridayReminder();
  //       await cancelDailyReminder();
  //       setNotificationsEnabled(false);
  //       Alert.alert('Success', 'Notifications disabled.');
  //     }
  //   } catch (error: any) {
  //     console.error('Error toggling notifications:', error);
  //     Alert.alert('Error', 'Failed to update notification settings');
  //   }
  // };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (newName.trim() === profile?.name) {
      setEditingName(false);
      return;
    }

    try {
      setSavingName(true);
      if (user?.id) {
        await updateProfileName(user.id, newName.trim());
        // Refresh profile to show updated name immediately
        await refreshProfile();
        Alert.alert('Success', 'Your name has been updated');
        setEditingName(false);
      }
    } catch (error: any) {
      console.error('Error saving name:', error);
      Alert.alert('Error', error.message || 'Failed to update name');
      setNewName(profile?.name || '');
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelNameEdit = () => {
    setNewName(profile?.name || '');
    setEditingName(false);
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
        
        {editingName ? (
          <View style={styles.nameEditContainer}>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              editable={!savingName}
              autoFocus
            />
            <View style={styles.nameEditActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelNameEdit}
                disabled={savingName}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <TouchableOpacity
                style={styles.nameDisplay}
                onPress={() => setEditingName(true)}
              >
                <Text style={styles.value}>
                  {profile?.name || 'Tap to add'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{user?.email || 'N/A'}</Text>
            </View>
          </>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.label}>Role:</Text>
          <Text style={styles.value}>
            {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'N/A'}
          </Text>
        </View>
      </View>

      {isAdmin && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Company Domain:</Text>
          <Text style={styles.value}>{COMPANY_DOMAIN || 'Not set'}</Text>
        </View>
      </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timezone</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Timezone:</Text>
          <Text style={styles.value}>Australia/Brisbane (AEST)</Text>
        </View>
        <Text style={styles.timezoneHint}>
          Timezone is locked to Brisbane for consistency.
        </Text>
      </View>

      {/* DISABLED: Notifications not working with Expo Go */}
      {/* <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationLabel}>Enable Reminders</Text>
            <Text style={styles.notificationHint}>
              Receive reminders for weekly (Friday 3 PM) and daily (5 PM) hour confirmations
            </Text>
          </View>
          {loadingNotifications ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : (
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
            />
          )}
        </View>
      </View> */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <Button
          title="Weekly Confirmation"
          onPress={() => router.push('/(app)/weekly-confirmation')}
          style={styles.adminButton}
        />
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Tools</Text>
          <Button
            title="Payroll Report"
            onPress={() => router.push('/(app)/payroll-report')}
            style={styles.adminButton}
          />
        </View>
      )}

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Management</Text>
          <MemberManagement isAdmin={isAdmin} currentUserId={user?.id} />
        </View>
      )}

      <View style={styles.section}>
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </View>

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
  adminButton: {
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
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 16,
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  notificationHint: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#999999',
  },
  nameEditContainer: {
    paddingVertical: 12,
    gap: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
  },
  nameEditActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nameDisplay: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
});
