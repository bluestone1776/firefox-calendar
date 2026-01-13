-- RE-ENABLE RLS AFTER TESTING
-- Run this to restore security policies after testing

-- Re-enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled (should return 't' for true)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'weekly_hours', 'events');

-- Note: After re-enabling, make sure you've run the QUICK_FIX_RLS.sql
-- to restore the proper policies
