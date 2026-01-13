-- DISABLE RLS FOR TESTING ONLY
-- ⚠️ WARNING: This disables all security policies. Only use for development/testing!
-- Run this in your Supabase SQL Editor to disable RLS temporarily

-- Disable RLS on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_hours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled (should return 'f' for false)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'weekly_hours', 'events');
