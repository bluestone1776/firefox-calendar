import { supabase } from '../lib/supabase';
import { Profile } from '../types';

/**
 * Lists all profiles
 */
export async function listProfiles(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('email', { ascending: true });

    if (error) {
      console.error('Error listing profiles:', error);
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in listProfiles:', error);
    throw error;
  }
}

/**
 * Updates a profile's timezone
 */
export async function updateProfileTimezone(
  profileId: string,
  timezone: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ timezone })
      .eq('id', profileId);

    if (error) {
      console.error('Error updating profile timezone:', error);
      throw new Error(`Failed to update timezone: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in updateProfileTimezone:', error);
    throw error;
  }
}

/**
 * Gets the current user's profile
 */
export async function getMyProfile(): Promise<Profile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Error fetching my profile:', error);
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getMyProfile:', error);
    throw error;
  }
}
