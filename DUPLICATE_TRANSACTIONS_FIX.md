# Duplicate Transactions & Username Display Fix - Complete

## Problem 1: Duplicate Transaction Recording
Every payment was being recorded twice in the transactions table because:
1. The send payment route was inserting directly with `adminSupabase.from("transactions").insert()`
2. Then calling `insertLedgerTransaction()` which also inserts
3. No duplicate checking based on `tx_hash`

## Problem 2: Transaction Display
When sending to @username, the transaction list showed the wallet address instead of the username.

## Fixes Applied

### Part 1: Removed Duplicate Inserts

**File: `src/app/api/payments/send/route.ts`**
- Removed direct transaction insert
- Added tx_hash duplicate check before inserting
- Now inserts ONLY ONCE via `insertLedgerTransaction()`
- Added `recipientUsername` field when payment sent to @username

```typescript
// Check for duplicate
const { data: existing } = await adminSupabase
  .from("transactions")
  .select("id")
  .eq("tx_hash", txHashToCheck)
  .maybeSingle();

if (existing) {
  console.log("⚠️ Transaction already recorded, skipping duplicate insert");
  return;
}

// Resolve username if toAddress starts with @
let recipientUsername: string | null = null;
if (toAddress.startsWith("@")) {
  recipientUsername = toAddress.substring(1);
}

// Insert ONCE via ledger service
await insertLedgerTransaction(adminSupabase, {
  userId: user.id,
  recipientUsername: recipientUsername,
  // ...
});
```

**Other files with duplicate checks added:**
- `src/lib/workflows/index.ts` - 2 insert locations
- `src/lib/agents/circle-agent.ts`
- `src/lib/services/subscription.ts`
- `src/app/api/subscriptions/process/route.ts`

### Part 2: Added recipient_username Column

**Database Schema:**
```sql
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS recipient_username TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_username 
ON public.transactions(recipient_username);
```

**File: `src/lib/services/ledger.ts`**
- Added `recipientUsername` to `LedgerTransactionInput` type
- Stores username (without @) when payment sent to @username

### Part 3: Updated Transaction Display Logic

**File: `src/context/FinancialContext.tsx`**

Display priority:
1. **If `recipient_username` exists** → Show `@username` as primary label
2. **Else if matched profile** → Show name or `@username` from profile lookup
3. **Else if wallet address** → Show truncated address (first 6...last 4)

```typescript
// Priority 1: Use recipient_username from database
if (t.recipient_username) {
  recipientUsername = t.recipient_username;
  txName = `@${t.recipient_username}`;
  txAvatar = t.recipient_username.substring(0, 2).toUpperCase();
}
// Priority 2: Use matched profile
else if (matched) {
  // ... existing logic
}
// Priority 3: Show truncated address
else if (recipientAddress && recipientAddress.startsWith("0x")) {
  txName = `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`;
}
```

**Realtime listener also updated** to handle `recipient_username` for new transactions.

## Migration Required

Run this SQL in Supabase Dashboard:
```bash
scripts/add-recipient-username-column.sql
```

## Result

✅ Each payment now recorded ONLY ONCE in transactions table
✅ Duplicate check prevents re-recording same tx_hash
✅ Payments to @username show username as primary label
✅ Payments to wallet address show truncated address
✅ Both username and address stored for proper display
