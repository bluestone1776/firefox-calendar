import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  return <Redirect href={isAuthenticated ? '/(app)/daily' : '/(auth)/login'} />;
}

