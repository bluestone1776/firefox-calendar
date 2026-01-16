import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../src/lib/supabase';

/**
 * Handles OAuth and email confirmation callbacks from Supabase
 * This route is triggered when users click email confirmation links
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Extract tokens from URL parameters
        const { access_token, refresh_token, type } = params;

        if (type === 'recovery') {
          // Password reset flow
          router.replace('/(auth)/login');
          return;
        }

        if (access_token && refresh_token) {
          // Set the session with the tokens from the email link
          const { error } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });

          if (error) {
            console.error('Error setting session:', error);
            router.replace('/(auth)/login');
            return;
          }

          // Successfully authenticated, redirect to app
          router.replace('/(app)/daily');
        } else {
          // No tokens, might be email confirmation
          // Check if user is already authenticated
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            router.replace('/(app)/daily');
          } else {
            router.replace('/(auth)/login');
          }
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
        router.replace('/(auth)/login');
      }
    };

    handleAuthCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Verifying...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
});
