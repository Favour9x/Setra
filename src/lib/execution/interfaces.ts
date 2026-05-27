export interface PaymentInput {
  recipient: string;
  amount: number;
  currency: string;
  userId: string;
  category?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface PaymentExecutor {
  execute(input: PaymentInput): Promise<PaymentResult>;
}
