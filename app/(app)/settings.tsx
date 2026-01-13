import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { COMPANY_DOMAIN } from '../../src/constants/company';
import { Button } from '../../src/components/ui/Button';

const DEFAULT_TZ = process.env.EXPO_PUBLIC_DEFAULT_TZ || 'Australia/Sydney';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

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
        <View style={styles.infoRow}>
          <Text style={styles.label}>Default Timezone:</Text>
          <Text style={styles.value}>{DEFAULT_TZ}</Text>
        </View>
      </View>

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
});
