import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTransactionStatus } from "@/lib/circle/client";
import { insertRecipientReceivedTransaction } from "@/lib/services/ledger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.RECOVER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pendingTxs, error } = await supabase
    .from("transactions")
    .select("id, metadata, tx_hash, recipient, amount, category")
    .eq("status", "pending")
    .not("metadata", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];

  for (const tx of pendingTxs || []) {
    const circleTxId = tx.metadata?.transactionId;
    if (!circleTxId) {
      results.push({ id: tx.id, error: "no transactionId in metadata" });
      continue;
    }

    try {
      const status = await getTransactionStatus(circleTxId);
      const isComplete = status.state === "COMPLETE" || status.state === "COMPLETED";

      if (isComplete || status.state === "FAILED") {
        const txHash = status.txHash || tx.tx_hash;

        await supabase
          .from("transactions")
          .update({
            status: isComplete ? "confirmed" : "failed",
            tx_hash: txHash,
          })
          .eq("id", tx.id);

        // Create received transaction for the recipient if not already done
        if (isComplete && txHash) {
          const destAddress = tx.metadata?.recipient_address || tx.recipient;
          await insertRecipientReceivedTransaction(supabase, {
            destinationAddress: destAddress,
            amount: Number(tx.amount) || 0,
            txHash,
            category: tx.category || "Transfer",
            metadata: { transactionId: circleTxId, recovered: true },
          });
        }
      }

      results.push({ id: tx.id, circleTxId, state: status.state, updated: isComplete || status.state === "FAILED" });
    } catch (err: any) {
      results.push({ id: tx.id, circleTxId, error: err.message });
    }
  }

  return NextResponse.json({ recovered: results.filter((r) => r.updated).length, results });
}
