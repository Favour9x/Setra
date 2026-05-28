import {
  initiateDeveloperControlledWalletsClient,
  Blockchain,
} from "@circle-fin/developer-controlled-wallets";

// Initialize Circle client
const getCircleClient = () => {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error("Circle API credentials not configured");
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
};

export interface CreateWalletResult {
  walletId: string;
  walletAddress: string;
  blockchain: string;
}

export interface WalletBalance {
  symbol: string;
  amount: string;
  tokenId?: string;
  tokenAddress?: string;
}

export interface TransferResult {
  transactionId: string;
  status: string;
  txHash?: string;
}

/**
 * Create a new wallet for a user
 */
export async function createEmbeddedWallet(
  userId: string
): Promise<CreateWalletResult> {
  const client = getCircleClient();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;

  if (!walletSetId) {
    throw new Error("Circle wallet set ID not configured");
  }

  const response = await client.createWallets({
    walletSetId,
    blockchains: [Blockchain.ArcTestnet],
    count: 1,
    accountType: "SCA",
    metadata: [
      {
        name: `wallet-${userId}`,
        refId: userId,
      },
    ],
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet) {
    throw new Error("Failed to create wallet");
  }

  return {
    walletId: wallet.id,
    walletAddress: wallet.address,
    blockchain: wallet.blockchain,
  };
}

/**
 * Get wallet balance for all tokens
 * Returns EXACT amounts from Circle API - NO local calculations
 */
export async function getWalletBalance(
  walletId: string
): Promise<WalletBalance[]> {
  const client = getCircleClient();

  console.log(`📡 CIRCLE SDK: Querying getWalletTokenBalance for wallet ${walletId}...`);
  const response = await client.getWalletTokenBalance({
    id: walletId,
  });

  console.log("================== CIRCLE RAW BALANCES RESPONSE ==================");
  console.log(JSON.stringify(response.data, null, 2));
  console.log("================================================================");

  const tokenBalances = response.data?.tokenBalances || [];

  // Return EXACT amounts from Circle API - no grouping, no summing, no calculations
  return tokenBalances.map((balance) => {
    const symbolRaw = balance.token?.symbol || "UNKNOWN";
    const normalizedSymbol = symbolRaw.toUpperCase();
    
    // Map known USDC variants to USDC for display
    const displaySymbol = 
      normalizedSymbol === "ETH" || 
      normalizedSymbol === "USD" || 
      normalizedSymbol === "USDC-ARC" || 
      normalizedSymbol === "USDC.E" || 
      normalizedSymbol === "USDC" 
        ? "USDC" 
        : normalizedSymbol;

    return {
      symbol: displaySymbol,
      amount: balance.amount || "0", // EXACT amount from Circle - no parsing, no arithmetic
      tokenId: balance.token?.id,
      tokenAddress: balance.token?.tokenAddress,
    };
  });
}

/**
 * Get USDC balance specifically
 */
export async function getUSDCBalance(walletId: string): Promise<string> {
  const balances = await getWalletBalance(walletId);
  const usdcBalance = balances.find((b) => b.symbol === "USDC");
  return usdcBalance?.amount || "0";
}

/**
 * Send a supported Circle wallet token to another address.
 * Uses Circle SDK per official docs: createTransaction with blockchain, walletAddress, destinationAddress
 */
export async function sendToken(
  fromWalletId: string,
  toAddress: string,
  amount: string,
  symbol: string = "USDC"
): Promise<TransferResult> {
  const client = getCircleClient();

  // Get wallet details to find the wallet address
  const walletResponse = await client.getWallet({ id: fromWalletId });
  const senderWalletAddress = walletResponse.data?.wallet?.address;
  
  if (!senderWalletAddress) {
    throw new Error("Failed to get sender wallet address");
  }

  console.log("================== CIRCLE TRANSACTION CREATE ==================");
  console.log("Circle tx created:", {
    blockchain: "ARC-TESTNET",
    senderWalletAddress,
    destinationAddress: toAddress,
    amount
  });
  console.log("==============================================================");

  // Create transaction using Circle SDK per docs
  const txResponse = await client.createTransaction({
    blockchain: "ARC-TESTNET" as any,
    walletAddress: senderWalletAddress,
    destinationAddress: toAddress,
    amount: [amount],
    tokenAddress: "0x3600000000000000000000000000000000000000", // USDC on Arc Testnet
    fee: { 
      type: "level", 
      config: { feeLevel: "MEDIUM" } 
    },
  });

  const transactionId = txResponse.data?.id;
  if (!transactionId) {
    throw new Error("Failed to create transfer transaction");
  }

  console.log("Circle tx created:", transactionId);

  // FIRE-AND-FORGET: Return immediately after submission.
  // Transaction status will be delivered via webhook.
  // The caller should insert a "pending" record and await webhook update.
  return {
    transactionId,
    status: "PENDING",
    txHash: undefined,
  };
}

/**
 * Send USDC to another address
 */
export async function sendUSDC(
  fromWalletId: string,
  toAddress: string,
  amount: string
): Promise<TransferResult> {
  return sendToken(fromWalletId, toAddress, amount, "USDC");
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(transactionId: string): Promise<{
  state: string;
  txHash?: string;
}> {
  const client = getCircleClient();

  const response = await client.getTransaction({
    id: transactionId,
  });

  return {
    state: response.data?.transaction?.state || "UNKNOWN",
    txHash: response.data?.transaction?.txHash,
  };
}
