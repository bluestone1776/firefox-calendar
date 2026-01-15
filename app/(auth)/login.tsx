import { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/hooks/useAuth';
import { isCompanyEmail } from '../../src/constants/company';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { ensureProfile } = useAuth();

  const handleAuth = async () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Block signup if email is not company domain
    if (isSignUp && !isCompanyEmail(email)) {
      Alert.alert(
        'Invalid Email Domain',
        'Only company email addresses are allowed for sign up. Please use your company email.'
      );
      return;
    }

    // Validate company email for magic link
    if (useMagicLink && !isCompanyEmail(email)) {
      Alert.alert(
        'Invalid Email Domain',
        'Only company email addresses are allowed. Please use your company email.'
      );
      return;
    }

    // Password required for non-magic-link auth
    if (!useMagicLink && !password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      if (useMagicLink) {
        // Magic link sign in
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: {
            emailRedirectTo: undefined, // No redirect needed for mobile
          },
        });

        if (error) {
          throw error;
        }

        Alert.alert(
          'Magic Link Sent',
          'Please check your email for the magic link to sign in.',
          [
            {
              text: 'OK',
              onPress: () => {
                setUseMagicLink(false);
              },
            },
          ]
        );
      } else if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password: password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          // Ensure profile is created
          await ensureProfile(data.user.id, data.user.email!);
          Alert.alert(
            'Success',
            'Account created successfully! Please check your email to verify your account.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(app)/daily'),
              },
            ]
          );
        }
      } else {
        // Sign in with password
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          // Ensure profile exists
          await ensureProfile(data.user.id, data.user.email!);
          router.replace('/(app)/daily');
        }
      }
    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.';

      if (error.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('Password')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Sign up with your company email'
              : 'Sign in to continue'}
          </Text>

          <View style={styles.form}>
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />

            {!useMagicLink && (
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? 'password-new' : 'password'}
                style={styles.input}
              />
            )}

            <Button
              title={
                useMagicLink
                  ? 'Send Magic Link'
                  : isSignUp
                  ? 'Sign Up'
                  : 'Sign In'
              }
              onPress={handleAuth}
              disabled={loading}
              style={styles.button}
            />

            {!isSignUp && (
              <Button
                title={useMagicLink ? 'Use Password Instead' : 'Use Magic Link Instead'}
                onPress={() => {
                  setUseMagicLink(!useMagicLink);
                  setPassword('');
                }}
                variant="outline"
                disabled={loading}
                style={styles.switchButton}
              />
            )}

            <Button
              title={isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setUseMagicLink(false);
                setPassword('');
              }}
              variant="outline"
              disabled={loading}
              style={styles.switchButton}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  switchButton: {
    marginTop: 8,
  },
});
