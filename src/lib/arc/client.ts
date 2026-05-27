import { createPublicClient, http, parseEther, formatEther } from "viem";

// Arc Testnet configuration
const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Scan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
};

// Create public client for Arc network
const getArcClient = () => {
  return createPublicClient({
    chain: ARC_TESTNET_CHAIN as any,
    transport: http(),
  });
};

export interface Transaction {
  to: string;
  value: string;
  data?: string;
  from?: string;
}

export interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  blockNumber?: bigint;
  transactionHash: string;
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedCost: string;
}

/**
 * Send a transaction on Arc network
 * Note: This is an abstraction layer. Actual signing happens via Circle SDK
 */
export async function sendTransaction(tx: Transaction): Promise<string> {
  // This is a placeholder for Arc execution
  // In practice, transactions are sent via Circle SDK which handles signing
  throw new Error(
    "Direct Arc transactions should be sent via Circle SDK. Use Circle client for wallet operations."
  );
}

/**
 * Get transaction status by hash
 */
export async function getTransactionStatus(
  txHash: string
): Promise<TransactionStatus> {
  const client = getArcClient();

  try {
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    return {
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      transactionHash: txHash,
    };
  } catch (error) {
    // Transaction not yet mined
    return {
      status: "pending",
      transactionHash: txHash,
    };
  }
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(tx: Transaction): Promise<GasEstimate> {
  const client = getArcClient();

  try {
    const gasLimit = await client.estimateGas({
      to: tx.to as `0x${string}`,
      value: parseEther(tx.value),
      data: tx.data as `0x${string}` | undefined,
      account: tx.from as `0x${string}` | undefined,
    });

    const gasPrice = await client.getGasPrice();

    const estimatedCost = formatEther(gasLimit * gasPrice);

    return {
      gasLimit,
      gasPrice,
      estimatedCost,
    };
  } catch (error) {
    throw new Error(`Failed to estimate gas: ${error}`);
  }
}

/**
 * Get current gas price on Arc network
 */
export async function getGasPrice(): Promise<bigint> {
  const client = getArcClient();
  return await client.getGasPrice();
}

/**
 * Get block number
 */
export async function getBlockNumber(): Promise<bigint> {
  const client = getArcClient();
  return await client.getBlockNumber();
}

/**
 * Get balance of an address
 * 
 * ⚠️ DEPRECATED: Do NOT use for UI balance display
 * Arc is EXECUTION ONLY - use Circle API for all balance queries
 * This function is kept only for internal Arc network operations
 */
export async function getBalance(address: string): Promise<string> {
  console.warn('⚠️ Arc getBalance called - this should NOT be used for UI balance display. Use Circle API instead.');
  const client = getArcClient();
  const balance = await client.getBalance({
    address: address as `0x${string}`,
  });
  return formatEther(balance);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  txHash: string,
  confirmations: number = 1
): Promise<TransactionStatus> {
  const client = getArcClient();

  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations,
    });

    return {
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      transactionHash: txHash,
    };
  } catch (error) {
    throw new Error(`Transaction failed: ${error}`);
  }
}
