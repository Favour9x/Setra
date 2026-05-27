-- Fix service_role permissions for profiles table
-- Run this in your Supabase SQL Editor to allow the service_role to bypass RLS

-- The service_role should automatically bypass RLS, but let's ensure it has the necessary grants
GRANT ALL ON public.profiles TO service_role;

-- Also grant usage on the schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all privileges on all tables in public schema to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant all privileges on all sequences in public schema to service_role
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- Verify the grants
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND grantee = 'service_role'
ORDER BY privilege_type;
