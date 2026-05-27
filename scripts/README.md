# Migration Scripts

## migrate-existing-users.ts

One-time migration script to create Circle wallets for existing users who signed up before the Circle wallet integration.

### What it does

1. Queries Supabase `profiles` table for all users where `wallet_id` is `NULL`
2. Creates a Circle wallet on ARC-TESTNET for each user
3. Updates their Supabase profile with `wallet_id` and `wallet_address`
4. Provides detailed progress and summary report

### Prerequisites

- Circle API credentials configured in `.env.local`
- Supabase credentials configured in `.env.local`
- `tsx` package installed (already included in dev dependencies)

### Usage

From the project root directory:

```bash
node --env-file=.env.local --import=tsx scripts/migrate-existing-users.ts
```

### Environment Variables Required

```env
CIRCLE_API_KEY=...
CIRCLE_ENTITY_SECRET=...
CIRCLE_WALLET_SET_ID=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Output Example

```
🚀 Starting user wallet migration...

📋 Fetching users without wallets...
✅ Found 3 user(s) without wallets

[1/3] Processing user: alice@example.com
  Creating wallet for user alice@example.com...
  ✅ Wallet created: 0x1234...5678
  ✅ Profile updated

[2/3] Processing user: bob@example.com
  Creating wallet for user bob@example.com...
  ✅ Wallet created: 0xabcd...ef01
  ✅ Profile updated

[3/3] Processing user: charlie@example.com
  Creating wallet for user charlie@example.com...
  ✅ Wallet created: 0x9876...5432
  ✅ Profile updated

============================================================
📊 Migration Summary
============================================================
Total users processed: 3
✅ Successful: 3
❌ Failed: 0

✅ Migration complete!
```

### Error Handling

- If a wallet creation fails for a user, the script continues with the next user
- Failed users are listed in the summary report
- The script exits with code 1 if the migration fails completely
- Individual user failures don't stop the entire migration

### Rate Limiting

The script includes a 1-second delay between each user to avoid Circle API rate limits.

### Safety

- **Idempotent**: Running the script multiple times is safe - it only processes users without `wallet_id`
- **Non-destructive**: Never overwrites existing wallet data
- **Transactional**: Each user is processed independently

### Verification

After running the migration, verify in Supabase:

```sql
-- Check how many users have wallets
SELECT 
  COUNT(*) as total_users,
  COUNT(wallet_id) as users_with_wallets,
  COUNT(*) - COUNT(wallet_id) as users_without_wallets
FROM profiles;

-- View users with wallets
SELECT id, email, wallet_address, created_at
FROM profiles
WHERE wallet_id IS NOT NULL
ORDER BY created_at DESC;
```

### Troubleshooting

**"Circle API credentials not configured"**
- Ensure `.env.local` has `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET`

**"Circle wallet set ID not configured"**
- Ensure `.env.local` has `CIRCLE_WALLET_SET_ID`

**"Supabase credentials not configured"**
- Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**"Failed to create wallet"**
- Check Circle API key permissions
- Verify entity secret is registered in Circle Console
- Check Circle API rate limits

**"Failed to update profile"**
- Verify Supabase RLS policies allow updates to profiles table
- Check that the user ID exists in the profiles table

### Rollback

If you need to rollback the migration (remove wallet data):

```sql
-- WARNING: This removes all wallet data from profiles
UPDATE profiles
SET wallet_id = NULL, wallet_address = NULL
WHERE wallet_id IS NOT NULL;
```

Note: This only removes the database records. Circle wallets will still exist and cannot be deleted via API.
