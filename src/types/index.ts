// Type definitions

export type Profile = {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'staff';
  created_at?: string;
  updated_at?: string;
};

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

export type Event = {
  id: string;
  profile_id: string;
  title: string;
  start: string; // ISO 8601 datetime string
  end: string; // ISO 8601 datetime string
  type: 'meeting' | 'personal' | 'leave';
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
