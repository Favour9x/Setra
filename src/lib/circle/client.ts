import {
  initiateDeveloperControlledWalletsClient,
  Blockchain,
} from "@circle-fin/developer-controlled-wallets";

export const BLOCKCHAINS = [
  {
    id: "ARC-TESTNET" as const,
    name: "Arc Testnet",
    isTestnet: true,
    usdcAddress: "0x3600000000000000000000000000000000000000",
    chainId: 5042002,
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  },
  {
    id: "ETH-SEPOLIA" as const,
    name: "Ethereum Sepolia",
    isTestnet: true,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    chainId: 11155111,
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    id: "BASE-SEPOLIA" as const,
    name: "Base Sepolia",
    isTestnet: true,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    chainId: 84532,
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    id: "MATIC-AMOY" as const,
    name: "Polygon Amoy",
    isTestnet: true,
    usdcAddress: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    chainId: 80002,
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  {
    id: "ARB-SEPOLIA" as const,
    name: "Arbitrum Sepolia",
    isTestnet: true,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    chainId: 421614,
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
];

export type BlockchainInfo = typeof BLOCKCHAINS[number];

const getCircleClient = () => {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) {
    throw new Error("Circle API credentials not configured");
  }
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
};

export interface WalletInfo {
  walletId: string;
  walletAddress: string;
  blockchain: string;
}

export async function createEmbeddedWallet(userId: string): Promise<WalletInfo> {
  const wallets = await createWalletsForUser(userId);
  return wallets[0] || { walletId: "", walletAddress: "", blockchain: "" };
}

export async function createWalletsForUser(userId: string): Promise<WalletInfo[]> {
  const client = getCircleClient();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (!walletSetId) throw new Error("Circle wallet set ID not configured");

  const wallets: WalletInfo[] = [];

  for (const chain of BLOCKCHAINS) {
    try {
      const response = await client.createWallets({
        walletSetId,
        blockchains: [chain.id as any],
        count: 1,
        accountType: "SCA",
        metadata: [{ name: `wallet-${userId}-${chain.id}`, refId: `${userId}:${chain.id}` }],
      });

      const wallet = response.data?.wallets?.[0];
      if (wallet) {
        wallets.push({ walletId: wallet.id, walletAddress: wallet.address, blockchain: wallet.blockchain });
      }
    } catch (error: any) {
      console.warn(`Failed to create wallet on ${chain.id}:`, error.message);
    }
  }

  return wallets;
}

export async function getWalletBalanceForBlockchain(
  walletId: string,
  blockchain?: string
) {
  const client = getCircleClient();
  const response = await client.getWalletTokenBalance({
    id: walletId,
    includeAll: true,
  });

  const tokenBalances = response.data?.tokenBalances || [];
  return tokenBalances.map((balance) => {
    const symbolRaw = balance.token?.symbol || "UNKNOWN";
    const normalizedSymbol = symbolRaw.toUpperCase();
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
      amount: balance.amount || "0",
      tokenId: balance.token?.id,
      tokenAddress: balance.token?.tokenAddress,
    };
  });
}

export async function getWalletBalance(walletId: string) {
  return getWalletBalanceForBlockchain(walletId);
}

export async function getUSDCBalance(walletId: string): Promise<string> {
  const balances = await getWalletBalanceForBlockchain(walletId);
  const usdcBalance = balances.find((b) => b.symbol === "USDC");
  return usdcBalance?.amount || "0";
}

export interface TransferResult {
  transactionId: string;
  status: string;
  txHash?: string;
}

export async function sendToken(
  fromWalletId: string,
  toAddress: string,
  amount: string,
  symbol: string = "USDC",
  blockchain?: string
): Promise<TransferResult> {
  const client = getCircleClient();
  const walletResponse = await client.getWallet({ id: fromWalletId });
  const senderWalletAddress = walletResponse.data?.wallet?.address;
  if (!senderWalletAddress) throw new Error("Failed to get sender wallet address");

  const chainConfig = blockchain
    ? BLOCKCHAINS.find((c) => c.id === blockchain || c.name === blockchain)
    : BLOCKCHAINS[0];
  const chainId = chainConfig?.id || "ARC-TESTNET";
  const tokenAddress = chainConfig?.usdcAddress || "0x3600000000000000000000000000000000000000";

  const txResponse = await client.createTransaction({
    blockchain: chainId as any,
    walletAddress: senderWalletAddress,
    destinationAddress: toAddress,
    amount: [amount],
    tokenAddress,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const transactionId = txResponse.data?.id;
  if (!transactionId) throw new Error("Failed to create transfer transaction");

  let transactionState = "INITIATED";
  let txHash: string | undefined;
  let attempts = 0;
  const maxAttempts = 40;
  const terminalStates = ["COMPLETE", "COMPLETED", "FAILED", "CANCELLED", "DENIED"];

  while (!terminalStates.includes(transactionState) && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await client.getTransaction({ id: transactionId });
    transactionState = statusResponse.data?.transaction?.state || "UNKNOWN";
    txHash = statusResponse.data?.transaction?.txHash;
    attempts++;
  }

  if (attempts >= maxAttempts) throw new Error("Transaction timeout");
  if (["FAILED", "CANCELLED", "DENIED"].includes(transactionState)) {
    throw new Error(`Transaction ${transactionState.toLowerCase()}`);
  }

  return { transactionId, status: transactionState, txHash };
}

export async function sendUSDC(
  fromWalletId: string,
  toAddress: string,
  amount: string
): Promise<TransferResult> {
  return sendToken(fromWalletId, toAddress, amount, "USDC");
}

export async function getTransactionStatus(transactionId: string) {
  const client = getCircleClient();
  const response = await client.getTransaction({ id: transactionId });
  return {
    state: response.data?.transaction?.state || "UNKNOWN",
    txHash: response.data?.transaction?.txHash,
  };
}

export async function listUserWallets(userId: string): Promise<WalletInfo[]> {
  const client = getCircleClient();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (!walletSetId) return [];

  const results: WalletInfo[] = [];
  const seenKeys = new Set<string>();

  // First pass: try to find wallets by refId for each chain
  for (const chain of BLOCKCHAINS) {
    try {
      const response = await client.listWallets({
        walletSetId,
        refId: `${userId}:${chain.id}`,
      });
      const wallet = response.data?.wallets?.[0];
      if (wallet) {
        const key = `${wallet.blockchain}:${wallet.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({ walletId: wallet.id, walletAddress: wallet.address, blockchain: wallet.blockchain });
        }
      }
    } catch {
    }
  }

  // Second pass: if any chains are missing, fetch all wallets in the set and match by blockchain
  const foundBlockchains = new Set(results.map((r) => r.blockchain));
  const missingChains = BLOCKCHAINS.filter((c) => !foundBlockchains.has(c.id));

  if (missingChains.length > 0) {
    try {
      const allResponse = await client.listWallets({ walletSetId });
      const allWallets = allResponse.data?.wallets || [];

      for (const chain of missingChains) {
        const match = allWallets.find((w: any) => w.blockchain === chain.id);
        if (match) {
          const key = `${match.blockchain}:${match.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push({ walletId: match.id, walletAddress: match.address, blockchain: match.blockchain });
          }
        }
      }
    } catch {
    }
  }

  return results;
}
