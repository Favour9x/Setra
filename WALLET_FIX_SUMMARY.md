# Wallet Fix Summary

## Problem
Wallet addresses were changing on every page refresh because:
1. Wallet creation was running on every page load
2. Supabase service_role didn't have permissions to save wallet_id to profiles table

## Fixes Applied

### 1. API Route (`/api/wallet/create/route.ts`)
- ✅ Added comprehensive logging at every step
- ✅ Check Supabase profiles table FIRST before calling Circle API
- ✅ Return existing wallet immediately if found (no Circle API call)
- ✅ **Changed to use authenticated user's session** for database writes (respects RLS)
- ✅ Verify wallet was saved after creation

### 2. FinancialContext (`src/context/FinancialContext.tsx`)
- ✅ Check React state FIRST before any API calls
- ✅ Only query Supabase if wallet not in state
- ✅ Only call API if wallet is NULL in both state and Supabase
- ✅ Added `walletId` and `walletAddress` to dependency array

## How It Works Now

**First Login:**
1. FinancialContext checks state (empty) → checks Supabase (NULL) → calls API
2. API checks Supabase (NULL) → creates Circle wallet → saves to Supabase using user's session
3. Wallet stored in React state

**Page Refresh:**
1. FinancialContext checks state (empty after refresh) → checks Supabase (has wallet) → uses existing
2. API never called
3. Wallet restored to React state

**Subsequent Refreshes:**
Same as above - Supabase is the source of truth

## Testing

1. **Refresh the page** in your browser (http://localhost:3000)
2. **Check browser console** for logs:
   - Should see: `✅ FinancialContext: Wallet found in Supabase profiles`
   - Should NOT see: `🆕 FinancialContext: Calling /api/wallet/create`
3. **Refresh multiple times** - wallet address should stay the same
4. **Check Supabase** profiles table - `wallet_id` should be populated

## Alternative: SQL Fix (if still having issues)

If you still see permission errors, run this SQL in Supabase Dashboard:

\`\`\`sql
-- Go to: https://supabase.com/dashboard/project/jdoagvioqvypiyvmgjwn/sql/new
-- Run this:

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO authenticated;
\`\`\`

Or see `scripts/fix-service-role-permissions.sql` for the complete fix.

## Files Changed
1. `src/app/api/wallet/create/route.ts` - Fixed to use authenticated session
2. `src/context/FinancialContext.tsx` - Fixed to check state first
3. `scripts/fix-service-role-permissions.sql` - SQL fix (if needed)
4. `FIX_SUPABASE_PERMISSIONS.md` - Instructions (if needed)
