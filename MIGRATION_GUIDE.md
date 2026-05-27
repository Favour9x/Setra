# User Wallet Migration Guide

## Overview
This guide helps you migrate existing Supabase users to have Circle wallets.

## Prerequisites

1. **Add wallet columns to Supabase** (if not already done):
   - Go to your Supabase project → SQL Editor
   - Run the SQL in `scripts/add-wallet-columns.sql`
   - This adds `wallet_id` and `wallet_address` columns to the `profiles` table

2. **Verify environment variables** in `.env.local`:
   ```env
   CIRCLE_API_KEY=...
   CIRCLE_ENTITY_SECRET=...
   CIRCLE_WALLET_SET_ID=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## Migration Steps

### Step 1: Check which users need wallets
```bash
npm run check:wallets
```

This shows:
- Total users in your database
- How many have wallets
- How many need wallets
- List of users without wallets

### Step 2: Run the migration
```bash
npm run migrate:users
```

This will:
- Create a Circle wallet for each user without one
- Update their Supabase profile with wallet info
- Show progress for each user
- Display a summary report

### Step 3: Verify the migration
```bash
npm run check:wallets
```

Should show all users now have wallets.

## What the Migration Does

For each user without a `wallet_id`:
1. Creates a Circle wallet on ARC-TESTNET
2. Updates their Supabase `profiles` record with:
   - `wallet_id`: Circle wallet ID
   - `wallet_address`: Ethereum address (0x...)
3. Includes 1-second delay between users to avoid rate limits

## Safety Features

- **Idempotent**: Safe to run multiple times (only processes users without wallets)
- **Non-destructive**: Never overwrites existing wallet data
- **Error handling**: Continues with other users if one fails
- **Detailed logging**: Shows progress and errors for each user

## Troubleshooting

**"column profiles.wallet_id does not exist"**
→ Run `scripts/add-wallet-columns.sql` in Supabase SQL Editor

**"Circle API credentials not configured"**
→ Check `.env.local` has all Circle environment variables

**"Failed to create wallet"**
→ Verify Circle API key permissions and entity secret registration

## Manual Verification in Supabase

After migration, run this SQL in Supabase:

```sql
-- Check migration status
SELECT 
  COUNT(*) as total_users,
  COUNT(wallet_id) as users_with_wallets,
  COUNT(*) - COUNT(wallet_id) as users_without_wallets
FROM profiles;

-- View migrated users
SELECT id, email, wallet_address, created_at
FROM profiles
WHERE wallet_id IS NOT NULL
ORDER BY created_at DESC;
```

## Scripts Reference

- `npm run check:wallets` - Check migration status
- `npm run migrate:users` - Run the migration
- `scripts/add-wallet-columns.sql` - Database schema update
- `scripts/migrate-existing-users.ts` - Migration script
- `scripts/check-users-without-wallets.ts` - Status check script
