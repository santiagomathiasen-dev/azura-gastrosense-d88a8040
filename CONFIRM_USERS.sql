-- Manually confirm all existing users in Supabase Auth
-- This is useful if you disabled email confirmation but have pending users
-- Run this in the Supabase SQL Editor

UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    last_sign_in_at = NOW(),
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;
