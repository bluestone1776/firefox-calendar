-- Fix the INSERT policy for profiles table
-- Run this in your Supabase SQL Editor

-- First, drop the existing policy
DROP POLICY IF EXISTS "Company users can insert own profile" ON public.profiles;

-- Recreate the policy to check the email from the row being inserted
CREATE POLICY "Company users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid() AND
  public.is_company_email(email)
);

-- Also update the is_company_email function to handle NULL better
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
