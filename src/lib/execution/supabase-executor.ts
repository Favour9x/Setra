import { createClient } from "@/lib/supabase-client";
import { PaymentExecutor, PaymentInput, PaymentResult } from "./interfaces";

export class SupabaseExecutor implements PaymentExecutor {
  private supabase = createClient();

  async execute(input: PaymentInput): Promise<PaymentResult> {
    const { recipient, amount, userId, category = "General" } = input;

    try {
      // 1. Fetch current balance to calculate new balance
      const { data: balanceData, error: fetchError } = await this.supabase
        .from('balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw new Error(`Failed to fetch balance: ${fetchError.message}`);
      
      const currentBalance = balanceData?.balance ? Number(balanceData.balance) : 0;
      if (currentBalance < amount) {
        return { success: false, error: "Insufficient funds" };
      }

      // 2. Perform transaction and balance update
      // Note: In a real prod app, this should be a Supabase RPC/transaction
      // But adhering to the requested flow from previous context.
      
      const { data: transData, error: transError } = await this.supabase
        .from('transactions')
        .insert({
          user_id: userId,
          recipient,
          amount,
          type: 'expense',
          category,
          status: 'success'
        })
        .select()
        .single();

      if (transError) throw transError;

      const { error: balanceError } = await this.supabase
        .from('balances')
        .update({ 
          balance: currentBalance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (balanceError) throw balanceError;

      return {
        success: true,
        transactionId: transData.id
      };
    } catch (error: any) {
      console.error("Supabase Execution Error:", error);
      return {
        success: false,
        error: error.message || "An unknown error occurred during execution"
      };
    }
  }
}
