-- Quick fix for RLS policy - Run this in Supabase SQL Editor
-- This fixes the profile creation issue

-- 1. Update the is_company_email function to include outlook.com for testing
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

-- 2. Drop and recreate the INSERT policy to check the email from the row being inserted
DROP POLICY IF EXISTS "Company users can insert own profile" ON public.profiles;

CREATE POLICY "Company users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid() AND
  public.is_company_email(email)
);

-- 3. Test the function (optional - run this to verify)
-- SELECT public.is_company_email('test@outlook.com'); -- Should return true
-- SELECT public.is_company_email('test@firefoxtraining.com.au'); -- Should return true
-- SELECT public.is_company_email('test@gmail.com'); -- Should return false
