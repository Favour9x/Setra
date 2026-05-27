import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchPaymentLinks, createPaymentLink, fetchPaymentHistoryForAddress } from "@/lib/services/payment-link";
import { resolveRecipientAddress } from "@/lib/resolve-username";
import { createClient } from "@supabase/supabase-js";
import { insertLedgerTransaction } from "@/lib/services/ledger";
import { createNotification } from "@/lib/services/notification";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// GET - List active payment links
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const links = await fetchPaymentLinks(user.id, supabase);
    
    // Embed transaction history for each checkout link
    const linksWithHistory = await Promise.all(
      links.map(async (link) => {
        const history = await fetchPaymentHistoryForAddress(link.recipient_address);
        return {
          ...link,
          history
        };
      })
    );

    return NextResponse.json({ success: true, links: linksWithHistory });
  } catch (error: any) {
    console.error("Fetch payment links API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch links" }, { status: 500 });
  }
}

// POST - Generate a new reusable payment link
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const body = await request.json();
    const { title, amount, currency, recipient_address } = body;
    const requestUserId = body.userId || body.user_id;

    if (requestUserId && requestUserId !== user.id) {
      return NextResponse.json({ error: "Wrong user" }, { status: 403 });
    }

    if (!title || !recipient_address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let resolvedRecipientAddress;
    try {
      resolvedRecipientAddress = await resolveRecipientAddress(recipient_address);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
    }

    const link = await createPaymentLink(user.id, {
      title,
      amount: amount === "" || amount === null ? null : Number(amount),
      currency: currency || "USDC",
      recipient_address: resolvedRecipientAddress
    }, supabase);

    return NextResponse.json({ success: true, link, shareable_path: `/pay/${link.id}` });
  } catch (error: any) {
    console.error("Create payment link API error:", error);
    return NextResponse.json({ error: error.message || "Failed to create link" }, { status: 500 });
  }
}

// PUT - Check and sync incoming Circle payments for active Tip links
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Get the user's profile to get their wallet_id and wallet_address
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.wallet_id || !profile.wallet_address) {
      return NextResponse.json({ error: "User wallet not found" }, { status: 400 });
    }

    const { wallet_id: walletId, wallet_address: walletAddress } = profile;

    // Dynamically import Circle SDK client
    const CircleClient = await import("@circle-fin/developer-controlled-wallets");
    
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      throw new Error("Circle API credentials not configured");
    }

    const client = CircleClient.initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // Fetch transactions from Circle
    const circleResponse = await client.listTransactions({
      walletIds: [walletId],
      order: "DESC" as any,
    });

    const circleTxs = circleResponse.data?.transactions || [];

    // Filter complete inbound transfers to user's wallet
    const inboundCompleteTxs = circleTxs.filter((tx: any) => {
      const isComplete = tx.state === "COMPLETE";
      const isTransfer = tx.operation === "TRANSFER";
      const isToMe = String(tx.destinationAddress || "").toLowerCase() === walletAddress.toLowerCase();
      return isComplete && isTransfer && isToMe;
    });

    const adminClient = getAdminClient();
    let newSyncCount = 0;

    for (const tx of inboundCompleteTxs) {
      const txHash = tx.txHash;
      if (!txHash) continue;

      // Check if this tx already exists in the transactions table
      const { data: existing, error: existingError } = await adminClient
        .from("transactions")
        .select("id")
        .eq("tx_hash", txHash)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking existing transaction:", existingError);
        continue;
      }

      if (!existing) {
        // It's a new incoming payment! Write to database and credit balance.
        const txAmountStr = tx.amounts?.[0] || "0";
        console.log(`✨ Found new incoming Tip payment! txHash: ${txHash}, amount: ${txAmountStr}`);

        // Insert ledger transaction
        await insertLedgerTransaction(adminClient, {
          userId: user.id,
          amount: Number(txAmountStr),
          recipientAddress: walletAddress,
          displayRecipient: tx.sourceAddress || "External Sender",
          txHash: txHash,
          status: "confirmed",
          type: "received",
          category: "Checkout",
          metadata: {
            blockchain: "ARC-TESTNET",
            circleTransactionId: tx.id,
            sourceAddress: tx.sourceAddress,
            destinationAddress: walletAddress
          }
        });

        // Create notification
        await createNotification(
          user.id,
          'payment_received',
          'USDC Tip Received',
          `You received a tip of $${Number(txAmountStr).toLocaleString()} USDC!`,
          {
            link: "/transactions",
            txHash: txHash
          }
        );

        newSyncCount++;
      }
    }

    return NextResponse.json({ success: true, processed: inboundCompleteTxs.length, synced: newSyncCount });
  } catch (error: any) {
    console.error("Tips polling API error:", error);
    return NextResponse.json({ error: error.message || "Failed to poll tips" }, { status: 500 });
  }
}
