import { useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { COMPANY_DOMAIN, isCompanyEmail } from '../constants/company';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(async (userId: string, email: string) => {
    // Check email domain
    if (!isCompanyEmail(email)) {
      await supabase.auth.signOut();
      Alert.alert(
        'Invalid Email Domain',
        `Only emails from ${COMPANY_DOMAIN} are allowed. Please sign in with a company email.`
      );
      return null;
    }

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      console.error('Error fetching profile:', fetchError);
      return null;
    }

    if (existingProfile) {
      setProfile(existingProfile);
      return existingProfile;
    }

    // Create profile if it doesn't exist
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email.toLowerCase(),
        role: 'staff',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return null;
    }

    setProfile(newProfile);
    return newProfile;
  }, []);

  const fetchProfile = useCallback(
    async (userId: string, email: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      // Verify email domain matches
      if (!isCompanyEmail(email)) {
        await supabase.auth.signOut();
        Alert.alert(
          'Invalid Email Domain',
          `Only emails from ${COMPANY_DOMAIN} are allowed. Please sign in with a company email.`
        );
        return null;
      }

      setProfile(data);
      return data;
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);
      if (session?.user) {
        const email = session.user.email;
        if (email) {
          await ensureProfile(session.user.id, email);
        }
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);
      if (session?.user) {
        const email = session.user.email;
        if (email) {
          if (event === 'SIGNED_IN') {
            await ensureProfile(session.user.id, email);
          } else {
            await fetchProfile(session.user.id, email);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [ensureProfile, fetchProfile]);

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAuthenticated: !!session,
    isAdmin: profile?.role === 'admin',
    ensureProfile: (userId: string, email: string) =>
      ensureProfile(userId, email),
  };
}
