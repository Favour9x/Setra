# Balance Doubling Fix - Complete

## Problem
Balance was showing double the actual amount. When receiving $20 USDC, the dashboard displayed $40.

## Root Cause
The `getWalletBalance` function in `src/lib/circle/client.ts` was:
1. Grouping multiple token entries by normalized symbol
2. **Summing amounts** when multiple tokens mapped to the same symbol (e.g., "ETH" and "USDC" both mapping to "USDC")
3. This caused Circle API responses with multiple USDC-like tokens to be added together

## Fixes Applied

### 1. Fixed Circle Client (`src/lib/circle/client.ts`)
**Before:**
```typescript
// Group and sum balances by normalized symbol
const groupedBalances: { [symbol: string]: { amount: number; ... } } = {};
for (const balance of tokenBalances) {
  // ...
  groupedBalances[normalizedSymbol].amount += amountVal; // ❌ SUMMING
}
```

**After:**
```typescript
// Return EXACT amounts from Circle API - no grouping, no summing, no calculations
return tokenBalances.map((balance) => {
  return {
    symbol: displaySymbol,
    amount: balance.amount || "0", // ✅ EXACT amount from Circle
    // ...
  };
});
```

### 2. Removed Optimistic Balance Updates (`src/context/FinancialContext.tsx`)
**Removed:**
```typescript
// ❌ Local balance calculation on payment send
setState(prev => ({
  ...prev,
  balance: prev.balance !== null ? prev.balance - amount : null,
  // ...
}));

// ❌ Local balance calculation on payment failure
setState(prev => ({ 
  ...prev, 
  balance: prev.balance !== null ? prev.balance + amount : null 
}));
```

**Replaced with:**
```typescript
// ✅ Always fetch from Circle API
await refreshBalance(); // Calls Circle SDK getWalletTokenBalance
```

### 3. Added Missing Dependency
Added `refreshBalance` to `sendPayment` callback dependencies.

## Circle SDK Usage (Per Official Docs)

```typescript
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Get balance - returns EXACT amounts from Circle
const response = await client.getWalletTokenBalance({ id: walletId });
const balance = response.data?.tokenBalances?.[0]?.amount;
```

## Key Principles

1. **Never calculate balance locally** - no addition, subtraction, or arithmetic
2. **Always fetch from Circle API** using `getWalletTokenBalance`
3. **Return exact string amounts** from Circle - no parsing, no summing
4. **No optimistic updates** - refresh balance after every transaction
5. **Frontend uses `.find()`** to get first USDC entry (not `.reduce()` or summing)

## Files Modified
- `src/lib/circle/client.ts` - Removed balance grouping/summing logic
- `src/context/FinancialContext.tsx` - Removed optimistic balance updates
- Balance now comes ONLY from Circle API `getWalletTokenBalance`

## Verification
- Balance API route (`/api/wallet/balance`) calls Circle SDK directly
- Frontend fetches balance via API and displays exact Circle amount
- No local arithmetic anywhere in the codebase
- After transactions, balance is refreshed from Circle API
