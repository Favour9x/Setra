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

export async function getWalletById(walletId: string) {
  const client = getCircleClient();
  return client.getWallet({ id: walletId });
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
  symbol: string = "USDC"
): Promise<TransferResult> {
  const client = getCircleClient();
  const walletResponse = await client.getWallet({ id: fromWalletId });
  const senderWalletAddress = walletResponse.data?.wallet?.address;
  if (!senderWalletAddress) throw new Error("Failed to get sender wallet address");

  const chainConfig = BLOCKCHAINS[0];
  const chainId = chainConfig.id;
  const tokenAddress = chainConfig.usdcAddress;

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

  if (results.length === 0) {
    try {
      const allResponse = await client.listWallets({ walletSetId, pageSize: 50 });
      const allWallets = allResponse.data?.wallets || [];
      for (const chain of BLOCKCHAINS) {
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
