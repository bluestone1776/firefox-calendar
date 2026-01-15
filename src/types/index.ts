// Type definitions

export type Profile = {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'staff';
  created_at?: string;
  updated_at?: string;
};

export type Event = {
  id: string;
  profile_id: string;
  title: string;
  start: string; // ISO 8601 datetime string
  end: string; // ISO 8601 datetime string
  type: 'meeting' | 'personal' | 'leave' | 'working_hours';
  is_recurring?: boolean; // For recurring weekly schedules
  recurrence_pattern?: number[]; // Array of day_of_week: [0,1,2,3,4,5,6] for Sun-Sat
  recurrence_end_date?: string | null; // ISO 8601 datetime string, null = infinite
  day_of_week?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (for weekly schedules)
  is_all_day?: boolean; // For all-day leave/unavailable
  created_by?: string; // User ID who created the event
  created_at?: string;
  updated_at?: string;
};

// Keep WeeklyHours for backward compatibility during migration
// This will be deprecated once migration is complete
// Note: This is now a legacy type - use Event with type='working_hours' instead
export type WeeklyHours = {
  id: string;
  profile_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  created_at?: string;
  updated_at?: string;
};

export type PayrollConfirmation = {
  id: string;
  profile_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  confirmed_hours: number;
  confirmed_at?: string;
  confirmed_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};
