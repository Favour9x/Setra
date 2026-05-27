import { createClient } from "@supabase/supabase-js";

export type LedgerTransactionInput = {
  userId: string;
  amount: number;
  recipientAddress: string;
  displayRecipient?: string;
  recipientUsername?: string | null;
  txHash?: string | null;
  status?: "confirmed" | "pending" | "failed" | "success" | "processing";
  type: "sent" | "received" | "expense" | "income";
  category?: string;
  metadata?: Record<string, any>;
};

export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function insertLedgerTransaction(client: any, input: LedgerTransactionInput) {
  const amount = Number(input.amount || 0);
  const status = input.status || "confirmed";
  const legacyStatus = status === "confirmed" || status === "success" ? "success" : status === "failed" ? "failed" : "pending";
  const legacyType = input.type === "received" || input.type === "income" ? "income" : "expense";
  const createdAt = new Date().toISOString();
  const metadata = {
    ...(input.metadata || {}),
    blockchain: "ARC-TESTNET",
    recipient_address: input.recipientAddress,
  };

  // Check for duplicate tx_hash + type before inserting
  // (same tx_hash can have both "expense" and "income" records for sender and recipient)
  if (input.txHash) {
    const { data: existing } = await client
      .from("transactions")
      .select("id")
      .eq("tx_hash", input.txHash)
      .eq("type", legacyType)
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      console.log(`⏭️ Transaction ${input.txHash} already recorded for type ${legacyType}, skipping duplicate`);
      return;
    }
  }

  // Build transaction data
  const txData: any = {
    user_id: input.userId,
    recipient: input.displayRecipient || input.recipientAddress,
    amount,
    type: legacyType,
    category: input.category || "Transfer",
    currency: "USDC",
    status: legacyStatus,
    tx_hash: input.txHash || null,
    metadata,
    created_at: createdAt,
  };

  // Add recipient_username if provided (for username-based payments)
  if (input.recipientUsername) {
    txData.recipient_username = input.recipientUsername;
  }

  // Use the actual schema columns
  const { error: insertError } = await client.from("transactions").insert(txData);

  if (insertError) {
    console.error("Failed to save transaction:", insertError);
  } else {
    console.log("✅ Transaction saved successfully");
  }
}

/**
 * Insert a RECEIVED transaction record for the recipient of a payment.
 * Looks up the recipient's user_id by wallet_address, checks for duplicates,
 * and inserts only if no existing record for that tx_hash + type.
 */
export async function insertRecipientReceivedTransaction(
  client: any,
  params: {
    destinationAddress: string;
    amount: number;
    txHash: string | null | undefined;
    displaySender?: string;
    category?: string;
    metadata?: Record<string, any>;
  }
) {
  if (!params.txHash) {
    console.log("⏭️ No txHash, skipping recipient received insert");
    return;
  }

  // Look up recipient user by wallet address
  const { data: recipientProfile } = await client
    .from("profiles")
    .select("id, username")
    .eq("wallet_address", params.destinationAddress)
    .maybeSingle();

  if (!recipientProfile?.id) {
    console.log(`⏭️ Recipient wallet ${params.destinationAddress} not a Setra user, skipping received record`);
    return;
  }

  // Check for duplicate: same tx_hash + received type
  const { data: existing } = await client
    .from("transactions")
    .select("id")
    .eq("tx_hash", params.txHash)
    .eq("type", "received")
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`⏭️ Received transaction for tx ${params.txHash} already exists, skipping`);
    return;
  }

  const { error } = await client.from("transactions").insert({
    user_id: recipientProfile.id,
    recipient: params.destinationAddress,
    amount: params.amount,
    type: "received",
    category: params.category || "Transfer",
    currency: "USDC",
    status: "success",
    tx_hash: params.txHash,
    metadata: {
      blockchain: "ARC-TESTNET",
      ...(params.metadata || {}),
    },
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Failed to insert recipient received transaction:", error.message);
  } else {
    console.log(`✅ Received transaction recorded for user ${recipientProfile.id}`);
  }
}

export async function creditUserBalance(client: any, userId: string, amount: number) {
  const creditAmount = Number(amount || 0);
  if (!userId || creditAmount <= 0) return;

  const { data: current, error: fetchError } = await client
    .from("balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load balance before credit:", fetchError);
    return;
  }

  const nextBalance = Number(current?.balance || 0) + creditAmount;
  
  if (current) {
    // Update existing balance
    const { error } = await client
      .from("balances")
      .update({
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to credit balance:", error);
    } else {
      console.log("✅ Balance credited successfully");
    }
  } else {
    // Insert new balance record
    const { error } = await client
      .from("balances")
      .insert({
        user_id: userId,
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Failed to create balance:", error);
    } else {
      console.log("✅ Balance created successfully");
    }
  }
}
