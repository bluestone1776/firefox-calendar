# Supabase SQL Schema

This document contains the complete SQL setup for the Firefox Calendar application.

## 1. Create Tables

```sql
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly hours table
CREATE TABLE public.weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute <= 59),
  end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 23),
  end_minute INTEGER NOT NULL CHECK (end_minute >= 0 AND end_minute <= 59),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, day_of_week)
);

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start TIMESTAMPTZ NOT NULL,
  "end" TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meeting', 'personal', 'leave')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ("end" > start)
);

-- Payroll confirmations table
CREATE TABLE public.payroll_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  confirmed_hours DECIMAL(5,2) NOT NULL CHECK (confirmed_hours >= 0),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, date)
);

-- Create indexes for better query performance
CREATE INDEX idx_weekly_hours_profile_id ON public.weekly_hours(profile_id);
CREATE INDEX idx_weekly_hours_day_of_week ON public.weekly_hours(day_of_week);
CREATE INDEX idx_events_profile_id ON public.events(profile_id);
CREATE INDEX idx_events_start ON public.events(start);
CREATE INDEX idx_events_end ON public.events("end");
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_payroll_confirmations_profile_id ON public.payroll_confirmations(profile_id);
CREATE INDEX idx_payroll_confirmations_date ON public.payroll_confirmations(date);
```

## 2. Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_confirmations ENABLE ROW LEVEL SECURITY;
```

## 3. Helper Functions

```sql
-- Function to check if email belongs to company domain
-- Note: Replace 'firefoxtraining.com.au' with your actual COMPANY_DOMAIN
-- For testing: outlook.com is whitelisted
CREATE OR REPLACE FUNCTION public.is_company_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF email IS NULL THEN
    RETURN FALSE;
  END IF;
  -- Replace 'firefoxtraining.com.au' with your actual COMPANY_DOMAIN
  -- For testing: also allow outlook.com
  RETURN LOWER(email) LIKE '%@firefoxtraining.com.au' OR
         LOWER(email) LIKE '%@outlook.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 4. RLS Policies

### Profiles Policies

```sql
-- Allow authenticated users with company email to SELECT all profiles
CREATE POLICY "Company users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Staff can UPDATE only their own profile
CREATE POLICY "Staff can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
)
WITH CHECK (
  id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
);

-- Admin can UPDATE any profile
CREATE POLICY "Admin can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
)
WITH CHECK (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
);

-- Allow INSERT for authenticated company users (profile creation on first login)
CREATE POLICY "Company users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid() AND
  public.is_company_email(email)
);
```

### Weekly Hours Policies

```sql
-- Allow authenticated company users to SELECT all weekly hours
CREATE POLICY "Company users can view all weekly hours"
ON public.weekly_hours
FOR SELECT
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Staff can INSERT/UPDATE/DELETE only their own weekly hours
CREATE POLICY "Staff can manage own weekly hours"
ON public.weekly_hours
FOR ALL
TO authenticated
USING (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
)
WITH CHECK (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
);

-- Admin can INSERT/UPDATE/DELETE any weekly hours
CREATE POLICY "Admin can manage any weekly hours"
ON public.weekly_hours
FOR ALL
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
)
WITH CHECK (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
);
```

### Events Policies

```sql
-- Allow authenticated company users to SELECT all events
CREATE POLICY "Company users can view all events"
ON public.events
FOR SELECT
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Staff can INSERT/UPDATE/DELETE only their own events
CREATE POLICY "Staff can manage own events"
ON public.events
FOR ALL
TO authenticated
USING (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
)
WITH CHECK (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
);

-- Admin can INSERT/UPDATE/DELETE any events
CREATE POLICY "Admin can manage any events"
ON public.events
FOR ALL
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
)
WITH CHECK (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
);
```

### Payroll Confirmations Policies

```sql
-- Allow authenticated company users to SELECT all payroll confirmations
CREATE POLICY "Company users can view all payroll confirmations"
ON public.payroll_confirmations
FOR SELECT
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Staff can INSERT/UPDATE/DELETE only their own payroll confirmations
CREATE POLICY "Staff can manage own payroll confirmations"
ON public.payroll_confirmations
FOR ALL
TO authenticated
USING (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
)
WITH CHECK (
  profile_id = auth.uid() AND
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  NOT public.is_admin()
);

-- Admin can INSERT/UPDATE/DELETE any payroll confirmations
CREATE POLICY "Admin can manage any payroll confirmations"
ON public.payroll_confirmations
FOR ALL
TO authenticated
USING (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
)
WITH CHECK (
  public.is_company_email((SELECT email FROM auth.users WHERE id = auth.uid())) AND
  public.is_admin()
);
```

## 5. Manual Step: Update Lenita to Admin

After Lenita's profile is created (on first login), run this SQL to set her role to admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'lenita@firefoxtraining.com.au';
```

**Note:** Make sure to replace `'firefoxtraining.com.au'` in the `is_company_email()` function with your actual `COMPANY_DOMAIN` value, or modify the function to read from a configuration table if you prefer a more dynamic approach.
