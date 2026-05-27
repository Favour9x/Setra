# Phase 6: Circle SDK Integration & Arc Execution Layer

## Overview
Phase 6 implements real Circle Developer-Controlled Wallets SDK integration and Arc execution abstraction layer for the Setra fintech application.

## Architecture

### 1. Circle Wallet Layer (`src/lib/circle/client.ts`)
Server-side Circle SDK integration for wallet management:
- **createEmbeddedWallet(userId)**: Creates a new wallet for a user on ARC-TESTNET
- **getWalletBalance(walletId)**: Fetches all token balances for a wallet
- **getUSDCBalance(walletId)**: Gets USDC balance specifically
- **sendUSDC(fromWalletId, toAddress, amount)**: Sends USDC with automatic transaction polling
- **getTransactionStatus(transactionId)**: Checks transaction status

### 2. Arc Execution Layer (`src/lib/arc/client.ts`)
Blockchain abstraction for Arc network:
- **getTransactionStatus(txHash)**: Get transaction receipt from Arc network
- **estimateGas(tx)**: Estimate gas costs for transactions
- **getBalance(address)**: Get native balance of an address
- **waitForTransaction(txHash)**: Wait for transaction confirmation

### 3. Payment Engine (`src/lib/payments/index.ts`)
Unified payment router:
- **executePayment(request)**: Routes USDC through Circle, other assets through Arc
- **getBalance(walletId)**: Fetch wallet balances
- **getUSDCBalance(walletId)**: Get USDC balance
- **createUserWallet(userId)**: Client-side wrapper for wallet creation
- **checkTransactionStatus(transactionId)**: Check payment status

### 4. API Routes

#### `/api/wallet/create` (POST)
Creates a Circle wallet for a new user and saves to Supabase profiles table.

**Request:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "walletId": "...",
    "walletAddress": "0x...",
    "blockchain": "ARC-TESTNET"
  }
}
```

#### `/api/wallet/balance` (POST)
Fetches wallet balance from Circle.

**Request:**
```json
{
  "walletId": "wallet-id"
}
```

**Response:**
```json
{
  "success": true,
  "balances": [
    { "symbol": "USDC", "amount": "100.5" }
  ]
}
```

#### `/api/payments/send` (POST)
Sends USDC payment via Circle and records in Supabase.

**Request:**
```json
{
  "walletId": "wallet-id",
  "toAddress": "0x...",
  "amount": "10.5",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "...",
  "txHash": "0x..."
}
```

#### `/api/user/profile` (GET)
Fetches user profile including wallet information.

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "wallet_id": "...",
    "wallet_address": "0x..."
  }
}
```

## Environment Variables

### Required (`.env.local`)
```env
# Circle Developer-Controlled Wallets
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
CIRCLE_WALLET_SET_ID=...
CIRCLE_ENV=sandbox

# Arc Network
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc.testnet.circle.com
ARC_TESTNET_CHAIN_ID=4653

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database Schema

### profiles table
Already includes:
- `wallet_id TEXT`: Circle wallet ID
- `wallet_address TEXT`: Wallet address (0x...)

### transactions table
Already includes:
- `tx_hash TEXT`: Blockchain transaction hash
- `metadata JSONB`: Additional transaction data (transactionId, blockchain, etc.)

## Integration Points

### 1. Signup Flow (`src/app/signup/page.tsx`)
- User signs up with email/password
- Circle wallet is automatically created via `/api/wallet/create`
- Wallet ID and address saved to Supabase profiles table
- Non-blocking: signup succeeds even if wallet creation fails

### 2. Send Payment Flow (`src/app/send/page.tsx`)
- User enters recipient address (0x...) and amount
- Fetches user's wallet ID from `/api/user/profile`
- Sends payment via `/api/payments/send`
- Transaction recorded in Supabase with tx_hash and metadata
- Balance refreshed from Circle after successful payment

### 3. Balance Display (`src/context/FinancialContext.tsx`)
- Fetches real Circle wallet balance via `/api/wallet/balance`
- Falls back to Supabase balance if Circle fetch fails
- Updates on page load and after transactions

## Key Implementation Details

### Circle SDK Server-Side Only
The Circle SDK uses Node.js modules (fs, http2) and cannot run in the browser. All Circle SDK calls are in:
- API routes (`src/app/api/**/route.ts`)
- Server-side functions (`src/lib/circle/client.ts`)

Webpack configuration excludes these modules from client bundle:
```typescript
// next.config.ts
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      http2: false,
    };
  }
  return config;
}
```

### Arc Testnet Compatibility
Circle SDK TypeScript types don't include "ARC-TESTNET" yet. Type assertions used:
```typescript
blockchain: "ARC-TESTNET" as any
```

### Transaction Polling
`sendUSDC()` automatically polls transaction status every 2 seconds until COMPLETE or FAILED (max 60 attempts = 2 minutes).

### Native USDC on Arc
For native USDC on ARC-TESTNET, no `tokenAddress` is needed in transaction creation. The SDK automatically uses the native token.

## Testing

### Dev Wallet Setup (`dev-controlled-projects/`)
Standalone scripts for testing Circle SDK:
- `create-wallet.ts`: Full wallet creation and transfer flow
- `test-transfer.ts`: Test transfers with existing wallet
- `generate-ciphertext.ts`: Generate entity secret ciphertext

Run with:
```bash
cd dev-controlled-projects
node --env-file=.env --import=tsx test-transfer.ts
```

## Dependencies Added
```json
{
  "@circle-fin/developer-controlled-wallets": "^latest",
  "axios": "^latest",
  "viem": "^latest",
  "ethers": "^latest"
}
```

## Future Enhancements
1. Support for other tokens beyond USDC
2. Multi-chain support (Ethereum, Polygon, etc.)
3. Transaction history from Circle API
4. Gas estimation for user display
5. Wallet recovery mechanisms
6. Multi-signature wallet support

## Security Considerations
- Entity secret stored in environment variables (never exposed to client)
- API routes validate user authentication
- Supabase RLS policies enforce user data isolation
- Wallet operations are server-side only
- Transaction amounts validated before execution

## Troubleshooting

### "Cannot find target token" error
- Ensure wallet is funded with USDC from Circle faucet
- Don't specify `tokenAddress` for native USDC on Arc

### Build errors with Circle SDK
- Verify `dev-controlled-projects` is excluded in `tsconfig.json`
- Check webpack fallback configuration in `next.config.ts`

### Wallet creation fails
- Verify `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, and `CIRCLE_WALLET_SET_ID` are set
- Check Circle API key has correct permissions
- Ensure entity secret is registered in Circle Console

## Resources
- [Circle Developer Docs](https://developers.circle.com/wallets/dev-controlled)
- [Arc Testnet Faucet](https://faucet.circle.com/)
- [Arc Testnet Explorer](https://explorer.arc.testnet.circle.com)
