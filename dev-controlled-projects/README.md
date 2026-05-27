# Circle Developer-Controlled Wallets Setup

## Prerequisites

1. Get your Circle API key from: https://console.circle.com/
2. Add it to `.env` file:
   ```
   CIRCLE_API_KEY=your_api_key_here
   ```

## Run the script

```bash
node --env-file=.env --import=tsx create-wallet.ts
```

## What the script does

1. Generates and registers an entity secret with Circle
2. Creates a wallet set named "ArcPayWallets"
3. Creates an EOA wallet on ARC-TESTNET
4. Saves wallet info to `.env` and `output/wallet-info.json`
5. Pauses for you to fund the wallet via faucet
6. Creates a second wallet
7. Sends 5 USDC to the second wallet
8. Polls until transaction completes
9. Prints both wallets' balances

## Output files

- `.env` - Updated with wallet credentials
- `output/recovery.json` - Entity secret recovery file (KEEP SAFE!)
- `output/wallet-info.json` - Wallet details

## Faucet

Get testnet USDC: https://faucet.circle.com/
