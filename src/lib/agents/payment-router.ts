import { PaymentExecutorAgent } from "./circle-agent";

export interface RoutedPaymentResult {
  success: boolean;
  method: "onchain";
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
  const executor = new PaymentExecutorAgent(userId);
  const result = await executor.executePayment(fromWalletId, toAddress, amount, description);

  return {
    success: result.success,
    method: "onchain",
    transactionId: result.transactionId,
    error: result.error,
  };
}
