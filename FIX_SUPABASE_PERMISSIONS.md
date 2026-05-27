# Fix Supabase Service Role Permissions

## Problem
The service_role doesn't have permissions to access the `profiles` table, causing wallet creation to fail with:
```
permission denied for table profiles
```

## Solution

### Option 1: Run SQL in Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/jdoagvioqvypiyvmgjwn/sql/new
2. Copy and paste the contents of `scripts/fix-service-role-permissions.sql`
3. Click "Run" to execute the SQL
4. Refresh your app - wallet creation should now work

### Option 2: Disable RLS on profiles table (NOT RECOMMENDED for production)

If you want to quickly test, you can disable RLS:

```sql
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
```

**WARNING**: This removes security protections. Only use for testing.

### Option 3: Use a different approach (Alternative)

Instead of using service_role, we can use the authenticated user's session to update their own profile. This requires modifying the API route to use the user's session instead of service_role.

## Verification

After running the SQL, check the server logs. You should see:
- ✅ Wallet found in Supabase (on refresh)
- ✅ Wallet saved to Supabase profiles table (on first creation)

No more permission errors!
