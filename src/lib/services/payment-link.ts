import { createClient } from "@supabase/supabase-js";
import { executePayment } from "@/lib/payments";
import { creditUserBalance, insertLedgerTransaction } from "@/lib/services/ledger";

export interface PaymentLink {
  id: string;
  user_id: string;
  title: string;
  amount: number | null; // null represents open contribution / donation links
  currency: string;
  recipient_address: string;
  active: boolean;
  created_at: string;
}

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function createPaymentLink(
  userId: string, 
  data: Omit<PaymentLink, "id" | "user_id" | "created_at" | "active">,
  supabase?: any
): Promise<PaymentLink> {
  const client = supabase || getAdminClient();

  const { data: inserted, error } = await client
    .from("payment_links")
    .insert({
      user_id: userId,
      title: data.title,
      amount: data.amount === null ? null : Number(data.amount),
      currency: data.currency || "USDC",
      recipient_address: data.recipient_address,
      active: true
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Supabase error inserting payment link:", error.message);
    throw error;
  }

  return inserted as PaymentLink;
}

export async function fetchPaymentLinks(userId: string, supabase?: any): Promise<PaymentLink[]> {
  const client = supabase || getAdminClient();

  const { data, error } = await client
    .from("payment_links")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Supabase error loading payment links:", error.message);
    throw error;
  }

  return data as PaymentLink[];
}

export async function fetchPaymentLinkById(id: string, supabase?: any): Promise<PaymentLink | null> {
  const client = supabase || getAdminClient();

  const { data, error } = await client
    .from("payment_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`❌ Supabase payment link fetch error for id ${id}:`, error.message);
    throw error;
  }

  return data as PaymentLink | null;
}

export async function executePaymentLinkPayment(
  linkId: string,
  amount: number,
  payingWalletId: string,
  payingUserId: string,
  supabase?: any
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    const client = supabase || getAdminClient();
    const link = await fetchPaymentLinkById(linkId, client);
    if (!link) {
      return { success: false, error: "Payment link not found" };
    }

    if (!link.active) {
      return { success: false, error: "This payment link is no longer active" };
    }

    console.log(`💸 Processing Circle USDC Payment for payment link ${linkId}...`);
    
    // Trigger Circle payment transfer flow
    const paymentResult = await executePayment({
      fromWalletId: payingWalletId,
      toAddress: link.recipient_address,
      amount: String(amount),
      type: "USDC"
    });

    if (!paymentResult.success) {
      return { success: false, error: paymentResult.error || "Circle payment failed" };
    }

    console.log("✅ Circle payment successful for Tips:", { 
      transactionId: paymentResult.transactionId, 
      txHash: paymentResult.txHash,
      amount,
      recipient: link.recipient_address
    });

    // Check for duplicate before inserting any transactions
    const txHash = paymentResult.txHash || paymentResult.transactionId || null;
    if (txHash) {
      const { data: existingTx } = await client
        .from("transactions")
        .select("id")
        .eq("tx_hash", txHash)
        .limit(1)
        .maybeSingle();
      
      if (existingTx) {
        console.log(`⏭️ Transaction ${txHash} already recorded, skipping duplicate`);
        return { success: true, txHash };
      }
    }

    // Insert single transaction record for payer
    await insertLedgerTransaction(client, {
      userId: payingUserId,
      recipientAddress: link.recipient_address,
      amount,
      type: "sent",
      category: "Checkout",
      status: "confirmed",
      txHash,
      metadata: {
        paymentLinkId: linkId,
        paymentLinkTitle: link.title,
        transactionId: paymentResult.transactionId
      }
    });

    // Insert single transaction record for recipient
    await insertLedgerTransaction(client, {
      userId: link.user_id,
      recipientAddress: link.recipient_address,
      amount,
      type: "received",
      category: "Checkout",
      status: "confirmed",
      txHash,
      metadata: {
        paymentLinkId: linkId,
        paymentLinkTitle: link.title,
        transactionId: paymentResult.transactionId,
        payerUserId: payingUserId
      }
    });

    await creditUserBalance(client, link.user_id, amount);
    const txError: any = null;

    /*
    const { error: txError } = await client.from("transactions").insert({
      user_id: payingUserId,
      recipient: link.recipient_address,
      amount: amount,
      type: "expense",
      category: "Transfer",
      currency: "USDC",
      status: "success",
      tx_hash: paymentResult.txHash,
      metadata: {
        paymentLinkId: linkId,
        paymentLinkTitle: link.title,
        blockchain: "ARC-TESTNET",
        transactionId: paymentResult.transactionId
      }
    });
    */

    if (txError) {
      console.warn("⚠️ Failed to write transaction log for payment link checkout:", txError.message);
    }

    return { 
      success: true, 
      txHash: paymentResult.txHash 
    };
  } catch (error: any) {
    console.error("❌ Error executing payment link checkout:", error);
    return { success: false, error: error.message || "Payment execution failed" };
  }
}

export async function fetchPaymentHistoryForAddress(recipientAddress: string): Promise<any[]> {
  const client = getAdminClient();

  const { data, error } = await client
    .from("transactions")
    .select("id, user_id, amount, status, created_at, metadata, recipient, recipient_address, tx_hash")
    .or(`recipient_address.eq.${recipientAddress},recipient.eq.${recipientAddress}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Supabase error loading payment history:", error.message);
    return [];
  }

  // Fetch usernames for the unique user_ids of the transactions
  const uniqueUserIds = [...new Set(data.map((tx: any) => tx.user_id))].filter(Boolean);
  const usernameMap: Record<string, string> = {};
  
  if (uniqueUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("id, username")
      .in("id", uniqueUserIds);
      
    if (!profilesError && profiles) {
      profiles.forEach((p: any) => {
        if (p.username) {
          usernameMap[p.id] = p.username;
        }
      });
    }
  }

  return data.map((tx: any) => {
    const metadataPayer = tx.metadata?.payer_name || tx.metadata?.payer_address;
    const dbPayer = usernameMap[tx.user_id];
    const payerDisplay = metadataPayer || (dbPayer ? `@${dbPayer}` : "Anonymous");

    return {
      id: tx.id,
      payer: payerDisplay,
      amount: Number(tx.amount || 0),
      timestamp: tx.created_at,
      status: tx.status
    };
  });
}
