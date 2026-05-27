# Setra Architecture Refactor - Single Source of Truth

## Executive Summary

This document defines the **strict separation of concerns** for the Setra fintech application to eliminate conflicts between Circle, Arc, and Supabase and establish Circle as the **single source of truth** for all financial data.

---

## 🎯 System Roles (ENFORCED)

### Circle - FINANCIAL SOURCE OF TRUTH ✅
**Role**: Primary financial system
**Responsibilities**:
- ✅ Wallet creation and management
- ✅ **USDC balance (ONLY SOURCE)**
- ✅ USDC transfers and transactions
- ✅ Transaction history source
- ✅ All financial state

**Rules**:
- ✅ ALL balance queries MUST go through Circle API
- ✅ NO other system may provide balance data
- ✅ UI MUST display Circle balance only
- ✅ Balance updates MUST trigger Circle API refresh

**API Endpoints**:
- `/api/wallet/create` → Circle SDK
- `/api/wallet/balance` → Circle SDK
- `/api/payments/send` → Circle SDK

---

### Arc - EXECUTION LAYER ONLY ✅
**Role**: Smart contract execution and automation
**Responsibilities**:
- ✅ Gas estimation
- ✅ Transaction status polling
- ✅ Block number queries
- ✅ Settlement abstraction (future)

**Rules**:
- ❌ NEVER used for balance display
- ❌ NEVER affects UI financial state
- ❌ NEVER modifies wallet state
- ✅ ONLY for backend execution workflows
- ✅ `getBalance()` function deprecated for UI use

**Usage**:
```typescript
// ✅ CORRECT: Gas estimation
const gasEstimate = await ArcClient.estimateGas(tx);

// ❌ WRONG: Balance display
const balance = await ArcClient.getBalance(address); // DO NOT USE FOR UI
```

---

### Supabase - METADATA ONLY ✅
**Role**: User data and metadata storage
**Responsibilities**:
- ✅ User profiles and authentication
- ✅ `wallet_id` + `wallet_address` mapping
- ✅ App settings (theme, notifications)
- ✅ Transaction logs cache (metadata only)
- ✅ User preferences

**Rules**:
- ❌ NEVER stores balance data
- ❌ NEVER used as balance source
- ✅ ONLY stores wallet identifiers
- ✅ Transaction logs are metadata cache only

**Schema**:
```sql
-- ✅ CORRECT: Wallet mapping
profiles (
  id uuid,
  wallet_id text,
  wallet_address text
)

-- ✅ CORRECT: Transaction metadata cache
transactions (
  id uuid,
  user_id uuid,
  recipient text,
  amount numeric,
  tx_hash text,
  status text,
  created_at timestamp
)

-- ❌ REMOVED: Balance table (no longer used)
-- balances table is deprecated
```

---

## 🔄 Data Flow Architecture

### Authentication Flow
```
User Signup
    ↓
Supabase: Create user profile
    ↓
Circle API: Create wallet
    ↓
Supabase: Store wallet_id + wallet_address
    ↓
Complete
```

### Dashboard Load Flow
```
User Login
    ↓
Supabase: Fetch wallet_id
    ↓
Circle API: Fetch balance (SINGLE SOURCE OF TRUTH)
    ↓
Supabase: Fetch transaction metadata
    ↓
FinancialContext: Update state
    ↓
UI: Render Circle balance
```

### Transaction Flow
```
User Sends Payment
    ↓
Circle API: Execute USDC transfer
    ↓
Supabase: Save transaction metadata
    ↓
Circle API: Refresh balance
    ↓
FinancialContext: Update state
    ↓
UI: Display new balance
```

### Faucet/Receive Flow
```
External Faucet: Send USDC to wallet
    ↓
User clicks refresh button
    ↓
Circle API: Fetch updated balance (with retry)
    ↓
FinancialContext: Update state
    ↓
UI: Display new balance
```

---

## 📊 FinancialContext Architecture

### State Structure
```typescript
interface FinancialState {
  balance: number;              // ✅ FROM CIRCLE ONLY
  transactions: Transaction[];  // ✅ FROM SUPABASE (metadata)
  activities: Activity[];       // ✅ DERIVED FROM TRANSACTIONS
  settings: UserSettings;       // ✅ FROM SUPABASE
  profile: UserProfile;         // ✅ FROM SUPABASE
}
```

### Balance Fetching (ENFORCED)
```typescript
// ✅ CORRECT: Fetch from Circle
const balanceResponse = await fetch('/api/wallet/balance', {
  method: 'POST',
  body: JSON.stringify({ walletId })
});
const { balances } = await balanceResponse.json();
const usdcBalance = balances.find(b => b.symbol === 'USDC');
const finalBalance = parseFloat(usdcBalance.amount);

// ❌ WRONG: Fetch from Supabase
const { data } = await supabase.from('balances').select('balance');
const balance = data.balance; // DO NOT USE

// ❌ WRONG: Fetch from Arc
const balance = await ArcClient.getBalance(address); // DO NOT USE
```

### Balance Refresh Methods
```typescript
// Method 1: Full data refresh
await refreshData(); // Fetches everything including balance

// Method 2: Balance-only refresh (faster)
await refreshBalance(); // Fetches only balance with retry
```

---

## 🚫 Removed Conflicts

### 1. Supabase Balance Table ✅
**Status**: Deprecated
**Reason**: Circle is single source of truth
**Action**: Removed all references to `balances` table in FinancialContext

**Before**:
```typescript
const [balanceRes, transRes] = await Promise.all([
  supabase.from('balances').select('balance'), // ❌ REMOVED
  supabase.from('transactions').select('*')
]);
```

**After**:
```typescript
const [transRes] = await Promise.all([
  supabase.from('transactions').select('*')
]);
// Balance fetched from Circle API only
```

### 2. Arc Balance Display ✅
**Status**: Deprecated for UI use
**Reason**: Arc is execution only
**Action**: Added deprecation warning to `getBalance()`

**Before**:
```typescript
export async function getBalance(address: string) {
  // Used for UI display ❌
}
```

**After**:
```typescript
export async function getBalance(address: string) {
  console.warn('⚠️ Do NOT use for UI balance display');
  // Only for internal Arc operations
}
```

### 3. Dual-Source Balance Merging ✅
**Status**: Removed
**Reason**: Causes inconsistent state
**Action**: Removed fallback to Supabase balance

**Before**:
```typescript
let balance = await fetchCircleBalance();
if (balance === 0) {
  balance = await fetchSupabaseBalance(); // ❌ REMOVED
}
```

**After**:
```typescript
const balance = await fetchCircleBalance();
// No fallback - Circle is single source of truth
```

---

## 🛡️ Safety & Stability

### Error Handling
```typescript
// ✅ All financial API calls wrapped in try/catch
try {
  const balance = await fetchCircleBalance();
  setState({ balance });
} catch (error) {
  console.error('Balance fetch failed:', error);
  // Don't crash - show last known balance
}
```

### SSR Safety
```typescript
// ✅ Circle SDK never loaded in browser
// All Circle operations in API routes only
import { createEmbeddedWallet } from "@/lib/circle/client"; // ❌ Server-side only

// ✅ Dynamic imports in API routes
const CircleClient = await import("../circle/client");
```

### Provider Crash Prevention
```typescript
// ✅ Supabase client creation wrapped
let supabase;
try {
  supabase = createClient();
} catch (err) {
  console.error('Supabase init failed:', err);
  // Continue without Supabase
}
```

### Loading States
```typescript
// ✅ Timeout prevents infinite loading
const timeout = setTimeout(() => {
  setIsLoaded(true);
}, 10000);
```

---

## 📝 Implementation Checklist

### ✅ Completed
- [x] Removed Supabase balance queries from FinancialContext
- [x] Established Circle as single source of truth
- [x] Added deprecation warning to Arc getBalance
- [x] Removed dual-source balance merging
- [x] Added retry mechanism to balance refresh
- [x] Added manual refresh button to dashboard
- [x] Added comprehensive console logging
- [x] Wrapped all API calls in try/catch
- [x] Added localStorage fallback for wallet data
- [x] Implemented SSR-safe initialization

### 🔄 Ongoing
- [ ] Monitor balance consistency in production
- [ ] Add balance polling for external faucets
- [ ] Implement transaction webhooks from Circle
- [ ] Add balance change notifications

### 🚀 Future Enhancements
- [ ] Real-time balance updates via WebSocket
- [ ] Transaction history pagination
- [ ] Multi-currency support (beyond USDC)
- [ ] Arc smart contract automation layer
- [ ] Circle webhook integration

---

## 🧪 Testing Guidelines

### Test 1: Balance Display
```
1. Login to dashboard
2. Verify balance shows Circle USDC amount
3. Check console: "💵 USDC Balance from Circle: X"
4. Verify NO Supabase balance queries
```

### Test 2: Faucet Integration
```
1. Claim from external faucet
2. Click refresh button on wallet card
3. Watch console for retry attempts
4. Verify balance updates to new amount
5. Verify NO Arc balance queries
```

### Test 3: Send Payment
```
1. Send USDC to another address
2. Verify balance decreases immediately
3. Verify Circle API called for new balance
4. Verify transaction saved to Supabase
5. Verify balance reflects Circle state
```

### Test 4: Error Handling
```
1. Disconnect internet
2. Try to refresh balance
3. Verify app doesn't crash
4. Verify error logged to console
5. Verify last known balance still displayed
```

---

## 📊 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    SETRA FRONTEND                        │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         FinancialContext (State)                │    │
│  │                                                  │    │
│  │  balance: number  ← CIRCLE ONLY                │    │
│  │  transactions: [] ← SUPABASE (metadata)        │    │
│  │  walletId: string ← SUPABASE (mapping)         │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                                │
│  ┌────────────────────────────────────────────────┐    │
│  │              Dashboard UI                       │    │
│  │                                                  │    │
│  │  Displays: Circle balance                      │    │
│  │  Refresh: Calls Circle API                     │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    API ROUTES                            │
│                                                          │
│  /api/wallet/balance  → Circle SDK → USDC Balance      │
│  /api/wallet/create   → Circle SDK → New Wallet        │
│  /api/payments/send   → Circle SDK → Transfer USDC     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  BACKEND SYSTEMS                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   CIRCLE     │  │     ARC      │  │  SUPABASE    │ │
│  │              │  │              │  │              │ │
│  │ • Wallets    │  │ • Gas Est.   │  │ • Profiles   │ │
│  │ • BALANCE ✅ │  │ • Tx Status  │  │ • wallet_id  │ │
│  │ • Transfers  │  │ • Execution  │  │ • Settings   │ │
│  │ • Tx History │  │              │  │ • Tx Cache   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│       ↑                   ↑                   ↑         │
│   FINANCIAL          EXECUTION           METADATA       │
│   TRUTH              ONLY                ONLY           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎓 Developer Guidelines

### Rule 1: Balance Queries
```typescript
// ✅ DO: Use Circle API
const balance = await fetch('/api/wallet/balance');

// ❌ DON'T: Use Supabase
const balance = await supabase.from('balances').select();

// ❌ DON'T: Use Arc
const balance = await ArcClient.getBalance();
```

### Rule 2: Transaction Flow
```typescript
// ✅ DO: Circle → Supabase → Refresh
await CircleAPI.sendUSDC();
await Supabase.saveTransaction();
await refreshBalance();

// ❌ DON'T: Update balance manually
setState({ balance: balance - amount });
```

### Rule 3: Arc Usage
```typescript
// ✅ DO: Use for execution
const gas = await ArcClient.estimateGas();
const status = await ArcClient.getTransactionStatus();

// ❌ DON'T: Use for balance
const balance = await ArcClient.getBalance(); // DEPRECATED
```

### Rule 4: Supabase Usage
```typescript
// ✅ DO: Store metadata
await supabase.from('profiles').update({ wallet_id });
await supabase.from('transactions').insert({ tx_hash });

// ❌ DON'T: Store balance
await supabase.from('balances').update({ balance }); // REMOVED
```

---

## 🚨 Common Pitfalls

### Pitfall 1: Using Supabase Balance
**Problem**: Supabase balance gets out of sync with Circle
**Solution**: Remove all Supabase balance queries

### Pitfall 2: Using Arc for UI Balance
**Problem**: Arc balance may differ from Circle
**Solution**: Use Arc only for execution, never for display

### Pitfall 3: Manual Balance Updates
**Problem**: UI shows incorrect balance after transaction
**Solution**: Always call `refreshBalance()` after transactions

### Pitfall 4: No Error Handling
**Problem**: App crashes when Circle API fails
**Solution**: Wrap all API calls in try/catch

---

## 📈 Success Metrics

### Balance Consistency
- ✅ UI balance always matches Circle API
- ✅ No discrepancies between sources
- ✅ Balance updates within 3 seconds

### System Stability
- ✅ No blank screens
- ✅ No infinite loading
- ✅ Graceful error handling
- ✅ SSR-safe initialization

### Developer Experience
- ✅ Clear separation of concerns
- ✅ Single source of truth
- ✅ Predictable data flow
- ✅ Easy to debug

---

## 🎯 Conclusion

The Setra architecture now enforces a **strict single-source-of-truth** system:

- **Circle**: Financial truth (balance, transactions)
- **Arc**: Execution only (gas, status)
- **Supabase**: Metadata only (profiles, settings)

This eliminates conflicts, ensures consistency, and provides a stable foundation for production deployment.

**Status**: ✅ ARCHITECTURE REFACTORED
**Date**: 2025-01-13
**Version**: 2.0 - Single Source of Truth
