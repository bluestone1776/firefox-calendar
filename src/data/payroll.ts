import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { supabase } from '../lib/supabase';
import { PayrollConfirmation } from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Gets payroll confirmation for a specific user and date
 * @param userId - User ID
 * @param dateISO - ISO date string (YYYY-MM-DD)
 */
export async function getPayrollConfirmation(
  userId: string,
  dateISO: string
): Promise<PayrollConfirmation | null> {
  try {
    const { data, error } = await supabase
      .from('payroll_confirmations')
      .select('*')
      .eq('profile_id', userId)
      .eq('date', dateISO)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return null;
      }
      console.error('Error fetching payroll confirmation:', error);
      throw new Error(`Failed to fetch payroll confirmation: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getPayrollConfirmation:', error);
    throw error;
  }
}

/**
 * Gets all payroll confirmations for a user within a date range
 * @param userId - User ID
 * @param startDateISO - Start date (YYYY-MM-DD)
 * @param endDateISO - End date (YYYY-MM-DD)
 */
export async function getPayrollConfirmationsForRange(
  userId: string,
  startDateISO: string,
  endDateISO: string
): Promise<PayrollConfirmation[]> {
  try {
    const { data, error } = await supabase
      .from('payroll_confirmations')
      .select('*')
      .eq('profile_id', userId)
      .gte('date', startDateISO)
      .lte('date', endDateISO)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching payroll confirmations:', error);
      throw new Error(`Failed to fetch payroll confirmations: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPayrollConfirmationsForRange:', error);
    throw error;
  }
}

/**
 * Gets all payroll confirmations for a specific week
 * @param userId - User ID
 * @param weekStartDateISO - Week start date (YYYY-MM-DD, typically Monday)
 */
export async function getPayrollConfirmationsForWeek(
  userId: string,
  weekStartDateISO: string
): Promise<PayrollConfirmation[]> {
  try {
    const weekStart = dayjs(weekStartDateISO);
    const weekEnd = weekStart.add(6, 'days');
    const weekEndISO = weekEnd.format('YYYY-MM-DD');

    return await getPayrollConfirmationsForRange(userId, weekStartDateISO, weekEndISO);
  } catch (error) {
    console.error('Error in getPayrollConfirmationsForWeek:', error);
    throw error;
  }
}

/**
 * Gets all payroll confirmations for all users within a date range (admin only)
 * @param startDateISO - Start date (YYYY-MM-DD)
 * @param endDateISO - End date (YYYY-MM-DD)
 */
export async function getAllPayrollConfirmationsForRange(
  startDateISO: string,
  endDateISO: string
): Promise<PayrollConfirmation[]> {
  try {
    const { data, error } = await supabase
      .from('payroll_confirmations')
      .select('*')
      .gte('date', startDateISO)
      .lte('date', endDateISO)
      .order('date', { ascending: true })
      .order('profile_id', { ascending: true });

    if (error) {
      console.error('Error fetching all payroll confirmations:', error);
      throw new Error(`Failed to fetch payroll confirmations: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllPayrollConfirmationsForRange:', error);
    throw error;
  }
}

/**
 * Creates or updates a payroll confirmation
 * @param payload - Payroll confirmation data
 */
export async function upsertPayrollConfirmation(
  payload: Omit<PayrollConfirmation, 'id' | 'created_at' | 'updated_at' | 'confirmed_at'>
): Promise<PayrollConfirmation> {
  try {
    // Validate payload
    if (!payload.profile_id || !payload.date || payload.confirmed_hours === undefined) {
      throw new Error('Missing required fields: profile_id, date, confirmed_hours');
    }

    if (payload.confirmed_hours < 0) {
      throw new Error('confirmed_hours must be >= 0');
    }

    // Validate date format
    const date = dayjs(payload.date);
    if (!date.isValid()) {
      throw new Error('Invalid date format. Use YYYY-MM-DD format.');
    }

    // Get current user for confirmed_by
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const insertData: any = {
      ...payload,
      confirmed_by: user?.id || null,
    };

    const { data, error } = await supabase
      .from('payroll_confirmations')
      .upsert(insertData, {
        onConflict: 'profile_id,date',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting payroll confirmation:', error);
      throw new Error(`Failed to save payroll confirmation: ${error.message}`);
    }

    if (!data) {
      throw new Error('Payroll confirmation upsert returned no data');
    }

    return data;
  } catch (error) {
    console.error('Error in upsertPayrollConfirmation:', error);
    throw error;
  }
}

/**
 * Deletes a payroll confirmation
 * @param confirmationId - Confirmation ID
 */
export async function deletePayrollConfirmation(confirmationId: string): Promise<void> {
  try {
    if (!confirmationId) {
      throw new Error('Confirmation ID is required');
    }

    const { error } = await supabase
      .from('payroll_confirmations')
      .delete()
      .eq('id', confirmationId);

    if (error) {
      console.error('Error deleting payroll confirmation:', error);
      throw new Error(`Failed to delete payroll confirmation: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deletePayrollConfirmation:', error);
    throw error;
  }
}
