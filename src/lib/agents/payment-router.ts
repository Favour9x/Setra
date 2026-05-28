import { PaymentExecutorAgent } from "./circle-agent";
import { withdrawFromGateway, getGatewayBalances } from "@/lib/gateway/client";

const GATEWAY_THRESHOLD = 1;

export interface RoutedPaymentResult {
  success: boolean;
  method: "gateway" | "onchain";
  txHash?: string;
  transactionId?: string;
  error?: string;
}

export async function routePayment(
  userId: string,
  fromWalletId: string,
  toAddress: string,
  amount: number,
  description: string = "Routed Payment",
): Promise<RoutedPaymentResult> {
  if (amount <= GATEWAY_THRESHOLD) {
    try {
      const balances = await getGatewayBalances();
      const gatewayAvail = parseFloat(balances.gatewayAvailable || "0");

      if (gatewayAvail >= amount) {
        const result = await withdrawFromGateway(amount.toString(), { recipient: toAddress });
        return { success: true, method: "gateway", txHash: result.mintTxHash };
      }
    } catch (err) {
      console.log(`Gateway unavailable or insufficient balance, falling back to onchain:`, err);
    }
  }

  const executor = new PaymentExecutorAgent(userId);
  const result = await executor.executePayment(fromWalletId, toAddress, amount, description);

  return {
    success: result.success,
    method: "onchain",
    transactionId: result.transactionId,
    error: result.error,
  };
}
