import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Initialize notifications when app starts (with error handling)
  // DISABLED: Notifications not working with Expo Go
  // useEffect(() => {
  //   if (isAuthenticated) {
  //     // Dynamically import to avoid blocking if notifications fail
  //     import('../src/utils/notifications')
  //       .then(({ initializeNotifications }) => {
  //         return initializeNotifications();
  //       })
  //       .catch((error) => {
  //         // Silently fail - notifications are optional
  //         console.warn('Failed to initialize notifications:', error);
  //       });
  //   }
  // }, [isAuthenticated]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not logged in and not in auth group -> redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !inAppGroup) {
      // Logged in and not in app group -> redirect to daily
      router.replace('/(app)/daily');
    }
  }, [isAuthenticated, loading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
