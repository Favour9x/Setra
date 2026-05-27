import { createClient } from "@supabase/supabase-js";
import { executePayment } from "@/lib/payments";
import { createNotification } from "@/lib/services/notification";
import { sendTransactionReceiptEmail } from "@/lib/services/email";
import { creditUserBalance, insertLedgerTransaction, insertRecipientReceivedTransaction } from "@/lib/services/ledger";

export interface Invoice {
  id: string;
  user_id: string;
  type?: "sent" | "received";
  sender_id?: string;
  sender_username?: string;
  recipient_username?: string;
  title: string;
  amount: number;
  currency: string;
  recipient_address: string;
  recipient_email?: string;
  email_status?: string;
  payer_address?: string;
  due_date: string;
  status: "pending" | "paid" | "expired" | "awaiting_confirmation";
  created_at: string;
}

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function createInvoice(
  userId: string, 
  data: Omit<Invoice, "id" | "user_id" | "created_at" | "status"> & { recipient_email?: string },
  supabase?: any
): Promise<Invoice> {
  const client = supabase || getAdminClient();
  const adminClient = getAdminClient();
  
  // Get sender's username
  const { data: senderProfile } = await adminClient
    .from("profiles")
    .select("username, wallet_address")
    .eq("id", userId)
    .maybeSingle();
  
  const senderUsername = senderProfile?.username || null;
  
  // Get recipient's user ID and username if they're registered
  const { data: recipientProfile } = await adminClient
    .from("profiles")
    .select("id, username")
    .eq("wallet_address", data.recipient_address)
    .maybeSingle();
  
  const recipientUserId = recipientProfile?.id || null;
  const recipientUsername = recipientProfile?.username || null;
  
  const createdAt = new Date().toISOString();
  
  // Insert sender's copy (sent invoice) - User A's record
  const { data: senderInvoice, error: senderError } = await adminClient
    .from("invoices")
    .insert({
      user_id: userId,
      title: data.title,
      amount: Number(data.amount),
      currency: data.currency || "USDC",
      recipient_address: data.recipient_address,
      due_date: data.due_date,
      status: "pending",
      type: "sent",
      created_at: createdAt
    })
    .select()
    .single();

  if (senderError) {
    console.error("❌ Supabase error inserting sender invoice:", senderError.message);
    throw senderError;
  }
  
  // If recipient is registered, insert recipient's copy (received invoice) - User B's record
  if (recipientUserId) {
    // Try with sender_address column first
    const recipientData: any = {
      user_id: recipientUserId,
      title: data.title,
      amount: Number(data.amount),
      currency: data.currency || "USDC",
      due_date: data.due_date,
      status: "pending",
      type: "received",
      created_at: createdAt
    };
    
    // Add sender_address if available
    if (senderProfile?.wallet_address) {
      recipientData.sender_address = senderProfile.wallet_address;
    }
    
    let { error: recipientError } = await adminClient
      .from("invoices")
      .insert(recipientData);
    
    // If column doesn't exist, retry without it
    if (recipientError && recipientError.code === "PGRST204") {
      console.log("⚠️ sender_address column may not exist, retrying without it...");
      delete recipientData.sender_address;
      const retry = await adminClient
        .from("invoices")
        .insert(recipientData);
      recipientError = retry.error;
    }
    
    if (recipientError) {
      console.error("❌ Failed to insert recipient invoice copy:", recipientError.message);
    } else {
      console.log("✅ Created received invoice copy for recipient");
    }
  }
  
  return senderInvoice as Invoice;
}

export async function fetchInvoices(userId: string, supabase?: any): Promise<Invoice[]> {
  const client = supabase || getAdminClient();

  // 1. Fetch user's profile to get their wallet address
  const { data: profile } = await client
    .from("profiles")
    .select("wallet_address")
    .eq("id", userId)
    .maybeSingle();

  const walletAddress = profile?.wallet_address?.toLowerCase();

  // 2. Fetch invoices where user is creator OR recipient
  let query = client.from("invoices").select("*");

  if (walletAddress) {
    query = query.or(`user_id.eq.${userId},recipient_address.ilike.${walletAddress}`);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Supabase error loading invoices:", error.message);
    throw error;
  }

  // 3. Fetch usernames separately for each unique creator user_id
  const uniqueUserIds = [...new Set(data.map((inv: any) => inv.user_id))].filter((id): id is string => typeof id === 'string');
  const usernameMap: Record<string, string> = {};

  for (const uid of uniqueUserIds) {
    const { data: userProfile } = await client
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .maybeSingle();

    if (userProfile?.username) {
      usernameMap[uid] = userProfile.username;
    }
  }

  // 4. Map with dynamic type: "received" if current user's wallet matches recipient_address, otherwise "sent"
  return data.map((inv: any) => {
    const isRecipient = walletAddress && inv.recipient_address?.toLowerCase?.() === walletAddress;
    return {
      ...inv,
      type: isRecipient ? "received" : "sent",
      sender_username: usernameMap[inv.user_id] || "creator"
    } as Invoice;
  });
}

export async function fetchInvoiceById(id: string, supabase?: any): Promise<Invoice | null> {
  const client = supabase || getAdminClient();

  const { data, error } = await client
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`❌ Supabase invoice fetch error for id ${id}:`, error.message);
    throw error;
  }

  return data as Invoice | null;
}

export async function updateInvoiceStatus(id: string, status: "pending" | "paid" | "expired" | "awaiting_confirmation", supabase?: any): Promise<boolean> {
  const client = supabase || getAdminClient();

  const { error } = await client
    .from("invoices")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error(`❌ Supabase error updating invoice status for id ${id}:`, error.message);
    throw error;
  }
  return true;
}

export async function payInvoice(
  invoiceId: string, 
  payingUserWalletId: string, 
  payingUserId: string,
  supabase?: any
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    const adminClient = getAdminClient();
    const invoice = await fetchInvoiceById(invoiceId, adminClient);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice.status === "paid") {
      return { success: false, error: "Invoice is already paid" };
    }

    // Get payer's wallet address
    const { data: payerProfile } = await adminClient
      .from("profiles")
      .select("wallet_address")
      .eq("id", payingUserId)
      .single();
    
    if (!payerProfile?.wallet_address) {
      return { success: false, error: "Payer wallet not found" };
    }

    // Get sender's wallet address (invoice creator)
    const { data: senderProfile } = await adminClient
      .from("profiles")
      .select("wallet_address, username")
      .eq("id", invoice.user_id)
      .single();
    
    if (!senderProfile?.wallet_address) {
      return { success: false, error: "Invoice creator wallet not found" };
    }

    console.log(`💸 Processing Circle USDC Payment for invoice ${invoiceId}...`);
    
    // Use Circle SDK directly
    const { initiateDeveloperControlledWalletsClient } = await import("@circle-fin/developer-controlled-wallets");
    
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });

    // Create transaction
    const txResponse = await client.createTransaction({
      blockchain: "ARC-TESTNET" as any,
      walletAddress: payerProfile.wallet_address,
      destinationAddress: senderProfile.wallet_address,
      amount: [invoice.amount.toString()],
      tokenAddress: "0x3600000000000000000000000000000000000000",
      fee: { 
        type: "level", 
        config: { feeLevel: "MEDIUM" } 
      },
    });

    const transactionId = txResponse.data?.id;
    if (!transactionId) {
      return { success: false, error: "Failed to create transaction" };
    }

    console.log("Circle tx created:", transactionId);

    // Poll for transaction completion
    let transactionState = "INITIATED";
    let txHash: string | undefined;
    let attempts = 0;
    const maxAttempts = 40;

    while (
      transactionState !== "COMPLETE" &&
      transactionState !== "FAILED" &&
      transactionState !== "CANCELLED" &&
      transactionState !== "DENIED" &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const statusResponse = await client.getTransaction({
        id: transactionId,
      });

      transactionState = statusResponse.data?.transaction?.state || "UNKNOWN";
      txHash = statusResponse.data?.transaction?.txHash;

      console.log("Circle tx state:", transactionState, "txHash:", txHash);

      attempts++;

      if (transactionState === "FAILED" || transactionState === "CANCELLED" || transactionState === "DENIED") {
        return { success: false, error: `Transaction ${transactionState.toLowerCase()}` };
      }
    }

    if (attempts >= maxAttempts) {
      return { success: false, error: "Transaction timeout" };
    }

    // Update invoice status to paid for BOTH sent and received copies
    await adminClient
      .from("invoices")
      .update({ status: "paid", payer_address: payerProfile.wallet_address })
      .eq("id", invoiceId);
    
    // Update the paired invoice (the other copy) by matching title and amount
    if (invoice.type === "sent") {
      await adminClient
        .from("invoices")
        .update({ status: "paid", payer_address: payerProfile.wallet_address })
        .eq("user_id", payingUserId)
        .eq("title", invoice.title)
        .eq("amount", invoice.amount)
        .eq("type", "received");
    } else if (invoice.type === "received") {
      await adminClient
        .from("invoices")
        .update({ status: "paid", payer_address: payerProfile.wallet_address })
        .eq("title", invoice.title)
        .eq("amount", invoice.amount)
        .eq("type", "sent");
    }

    // Insert sender's transaction record
    await insertLedgerTransaction(adminClient, {
      userId: payingUserId,
      recipientAddress: senderProfile.wallet_address,
      displayRecipient: senderProfile.username ? `@${senderProfile.username}` : senderProfile.wallet_address,
      amount: invoice.amount,
      type: "sent",
      category: "Invoice",
      status: "confirmed",
      txHash: txHash || transactionId,
      metadata: {
        invoiceId: invoiceId,
        invoiceTitle: invoice.title,
        transactionId: transactionId,
        blockchain: "ARC-TESTNET"
      }
    });

    // Insert recipient's received transaction record
    await insertRecipientReceivedTransaction(adminClient, {
      destinationAddress: senderProfile.wallet_address,
      amount: invoice.amount,
      txHash: txHash || transactionId,
      displaySender: payerProfile.wallet_address,
      category: "Invoice",
      metadata: {
        invoiceId: invoiceId,
        invoiceTitle: invoice.title,
        transactionId: transactionId,
      }
    });

    // Send notification to invoice creator
    const { data: payerUsername } = await adminClient
      .from("profiles")
      .select("username")
      .eq("id", payingUserId)
      .maybeSingle();
    
    const payerDisplay = payerUsername?.username ? `@${payerUsername.username}` : "Someone";
    
    await createNotification(
      invoice.user_id,
      "payment_received",
      "Invoice Paid",
      `${payerDisplay} has paid your invoice of ${invoice.amount} USDC`,
      { 
        invoice_id: invoiceId, 
        amount: invoice.amount,
        payer_id: payingUserId,
        tx_hash: txHash,
        link: `/invoices/${invoiceId}`
      }
    );

    return { success: true, txHash: txHash || transactionId };
  } catch (error: any) {
    console.error("❌ Pay invoice error:", error);
    return { success: false, error: error.message || "Payment failed" };
  }
}
