import { PaymentInput, PaymentResult } from "./interfaces";
import { SupabaseExecutor } from "./supabase-executor";

/**
 * Execution Manager
 * Routes payment requests to the appropriate executor.
 * Currently uses SupabaseExecutor, but can be swapped for Circle Agents or Arc
 * without changing the frontend logic.
 */
const supabaseExecutor = new SupabaseExecutor();

export async function executePayment(input: PaymentInput): Promise<PaymentResult> {
  // Logic to determine which executor to use could go here
  // For now, we default to Supabase
  return await supabaseExecutor.execute(input);
}

export * from "./interfaces";
