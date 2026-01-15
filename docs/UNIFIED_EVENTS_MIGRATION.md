# Unified Events Table Migration

## Overview
This migration unifies the `weekly_hours` and `events` tables into a single `events` table that can handle:
- One-time events (meetings, personal, leave)
- Recurring weekly schedules (working hours)
- All-day events (leave/unavailable)

## Schema Changes

### New Events Table Structure

```sql
-- Add new columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB, -- Array of day_of_week: [0,1,2,3,4,5,6] for Sun-Sat
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ, -- NULL = infinite recurrence
ADD COLUMN IF NOT EXISTS day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- For weekly schedules
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;

-- Update type to include 'working_hours'
ALTER TABLE public.events 
DROP CONSTRAINT IF EXISTS events_type_check;

ALTER TABLE public.events 
ADD CONSTRAINT events_type_check 
CHECK (type IN ('meeting', 'personal', 'leave', 'working_hours'));

-- Add index for recurring events
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON public.events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_events_day_of_week ON public.events(day_of_week) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_recurrence_pattern ON public.events USING GIN(recurrence_pattern) WHERE is_recurring = TRUE;
```

## Migration Script

### Step 1: Migrate weekly_hours to events

```sql
-- Migrate existing weekly_hours to events table
INSERT INTO public.events (
  profile_id,
  title,
  start,
  "end",
  type,
  is_recurring,
  day_of_week,
  recurrence_pattern,
  created_at,
  updated_at
)
SELECT 
  profile_id,
  'Working Hours' as title,
  -- Use a reference date (e.g., 2024-01-01) for start/end times
  (TIMESTAMP '2024-01-01' + (start_hour || ' hours')::INTERVAL + (start_minute || ' minutes')::INTERVAL) as start,
  (TIMESTAMP '2024-01-01' + (end_hour || ' hours')::INTERVAL + (end_minute || ' minutes')::INTERVAL) as "end",
  'working_hours' as type,
  TRUE as is_recurring,
  day_of_week,
  jsonb_build_array(day_of_week) as recurrence_pattern, -- Single day pattern
  created_at,
  updated_at
FROM public.weekly_hours;

-- Verify migration
SELECT COUNT(*) FROM public.events WHERE type = 'working_hours';
SELECT COUNT(*) FROM public.weekly_hours; -- Should match
```

### Step 2: Update RLS Policies

The existing RLS policies for events should work for working_hours type as well since they check profile_id.

### Step 3: Drop weekly_hours table (after verification)

```sql
-- Only run after verifying everything works!
-- DROP TABLE IF EXISTS public.weekly_hours CASCADE;
```

## Data Model

### Event Types:
- `meeting` - One-time or recurring meetings
- `personal` - Personal appointments
- `leave` - Leave/unavailable days (can be all-day)
- `working_hours` - Recurring weekly working schedule

### For Weekly Working Hours:
- `is_recurring = TRUE`
- `type = 'working_hours'`
- `day_of_week` = 0-6 (Sunday-Saturday)
- `recurrence_pattern` = [day_of_week] (for single day) or [0,1,2,3,4,5,6] (for all days)
- `start` = Reference datetime with time (e.g., 2024-01-01 09:00:00)
- `end` = Reference datetime with time (e.g., 2024-01-01 17:00:00)
- `title` = "Working Hours" or custom name

### For One-time Events:
- `is_recurring = FALSE`
- `type` = 'meeting', 'personal', or 'leave'
- `start` = Actual event start datetime
- `end` = Actual event end datetime

### For All-day Leave:
- `is_all_day = TRUE`
- `type = 'leave'`
- `start` = Date at 00:00:00
- `end` = Date at 23:59:59

## Query Examples

### Get weekly hours for a weekday:
```sql
SELECT * FROM events 
WHERE is_recurring = TRUE 
  AND type = 'working_hours'
  AND day_of_week = 1 -- Monday
  AND profile_id = 'user-id';
```

### Get all recurring weekly schedules:
```sql
SELECT * FROM events 
WHERE is_recurring = TRUE 
  AND type = 'working_hours'
  AND profile_id = 'user-id'
ORDER BY day_of_week;
```

### Get events for a specific date:
```sql
SELECT * FROM events 
WHERE profile_id = 'user-id'
  AND (
    -- One-time events on this date
    (is_recurring = FALSE AND DATE(start) = '2024-01-15')
    OR
    -- Recurring weekly schedule for this weekday
    (is_recurring = TRUE 
     AND type = 'working_hours' 
     AND day_of_week = EXTRACT(DOW FROM '2024-01-15'::DATE))
  );
```
