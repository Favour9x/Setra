// NOTE: Circle and Arc clients are server-side only (Node.js modules)
// They should NEVER be imported in client components
// Use API routes instead for client-side operations

export type PaymentType = "USDC" | "ETH" | "OTHER";

export interface PaymentRequest {
  fromWalletId: string;
  toAddress: string;
  amount: string;
  type: PaymentType;
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

/**
 * Unified payment router (SERVER-SIDE ONLY)
 * This function should only be called from API routes, never from client components
 * Routes payments through Circle for USDC, Arc for other assets
 */
export async function executePayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  // Dynamically import Circle client only when needed (server-side)
  const CircleClient = await import("../circle/client");
  
  try {
    if (request.type === "USDC") {
      // Route USDC payments through Circle
      const result = await CircleClient.sendUSDC(
        request.fromWalletId,
        request.toAddress,
        request.amount
      );

      return {
        success: true,
        transactionId: result.transactionId,
        txHash: result.txHash,
      };
    } else {
      // Other assets would route through Arc execution layer
      // For now, this is not implemented
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

/**
 * Get balance for a wallet (SERVER-SIDE ONLY)
 * This function should only be called from API routes
 */
export async function getBalance(walletId: string): Promise<BalanceResult[]> {
  // Dynamically import Circle client only when needed (server-side)
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

/**
 * Get USDC balance specifically (SERVER-SIDE ONLY)
 * This function should only be called from API routes
 */
export async function getUSDCBalance(walletId: string): Promise<string> {
  // Dynamically import Circle client only when needed (server-side)
  const CircleClient = await import("../circle/client");
  
  try {
    return await CircleClient.getUSDCBalance(walletId);
  } catch (error: any) {
    throw new Error(`Failed to get USDC balance: ${error.message}`);
  }
}

/**
 * Create a wallet for a new user (client-side wrapper)
 */
export async function createUserWallet(userId: string): Promise<void> {
  try {
    const response = await fetch("/api/wallet/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create wallet");
    }

    const data = await response.json();
    console.log("Wallet created:", data.wallet);
  } catch (error: any) {
    console.error("Wallet creation error:", error);
    throw error;
  }
}

/**
 * Get transaction history (placeholder for future implementation)
 */
export async function getTransactionHistory(
  walletId: string
): Promise<any[]> {
  // This would query Supabase for transaction history
  // For now, return empty array
  return [];
}

/**
 * Check transaction status (SERVER-SIDE ONLY)
 * This function should only be called from API routes
 */
export async function checkTransactionStatus(transactionId: string): Promise<{
  state: string;
  txHash?: string;
}> {
  // Dynamically import Circle client only when needed (server-side)
  const CircleClient = await import("../circle/client");
  
  try {
    return await CircleClient.getTransactionStatus(transactionId);
  } catch (error: any) {
    throw new Error(`Failed to check transaction status: ${error.message}`);
  }
}

/**
 * Estimate gas for Arc transactions (SERVER-SIDE ONLY - future use)
 * This function should only be called from API routes
 */
export async function estimateTransactionCost(
  toAddress: string,
  amount: string
): Promise<string> {
  // Dynamically import Arc client only when needed (server-side)
  const ArcClient = await import("../arc/client");
  
  try {
    const estimate = await ArcClient.estimateGas({
      to: toAddress,
      value: amount,
    });
    return estimate.estimatedCost;
  } catch (error: any) {
    // Return default estimate if estimation fails
    return "0.001";
  }
}
