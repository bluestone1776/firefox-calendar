import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
