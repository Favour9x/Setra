export type PaymentType = "USDC" | "ETH" | "OTHER";

export interface PaymentRequest {
  fromWalletId: string;
  toAddress: string;
  amount: string;
  type: PaymentType;
  blockchain?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  error?: string;
}

export interface BalanceResult {
  symbol: string;
  amount: string;
}

export async function executePayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  const CircleClient = await import("../circle/client");

  try {
    if (request.type === "USDC") {
      const result = await CircleClient.sendToken(
        request.fromWalletId,
        request.toAddress,
        request.amount,
        "USDC",
        request.blockchain
      );

      return {
        success: true,
        transactionId: result.transactionId,
        txHash: result.txHash,
      };
    } else {
      throw new Error(
        `Payment type ${request.type} not yet supported. Only USDC is currently available.`
      );
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Payment failed",
    };
  }
}

export async function getBalance(walletId: string): Promise<BalanceResult[]> {
  const CircleClient = await import("../circle/client");

  try {
    const balances = await CircleClient.getWalletBalance(walletId);
    return balances.map((b) => ({
      symbol: b.symbol,
      amount: b.amount,
    }));
  } catch (error: any) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

export async function getUSDCBalance(walletId: string): Promise<string> {
  const CircleClient = await import("../circle/client");

  try {
    return await CircleClient.getUSDCBalance(walletId);
  } catch (error: any) {
    throw new Error(`Failed to get USDC balance: ${error.message}`);
  }
}

export async function createUserWallet(userId: string): Promise<void> {
  try {
    const response = await fetch("/api/wallet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create wallet");
    }
  } catch (error: any) {
    console.error("Wallet creation error:", error);
    throw error;
  }
}

export async function getTransactionHistory(walletId: string): Promise<any[]> {
  return [];
}

export async function checkTransactionStatus(transactionId: string) {
  const CircleClient = await import("../circle/client");
  try {
    return await CircleClient.getTransactionStatus(transactionId);
  } catch (error: any) {
    throw new Error(`Failed to check transaction status: ${error.message}`);
  }
}

export async function estimateTransactionCost(
  toAddress: string,
  amount: string
): Promise<string> {
  const ArcClient = await import("../arc/client");

  try {
    const estimate = await ArcClient.estimateGas({
      to: toAddress,
      value: amount,
    });
    return estimate.estimatedCost;
  } catch (error: any) {
    return "0.001";
  }
}
