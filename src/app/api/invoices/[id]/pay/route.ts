import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { payInvoice } from "@/lib/services/invoice";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Load the paying user's profile to extract their wallet_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
    }

    // If wallet_id is null, create a Circle wallet automatically
    let walletId = profile?.wallet_id;
    if (!walletId) {
      try {
        const createWalletResponse = await fetch(`${request.nextUrl.origin}/api/wallet/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
          body: JSON.stringify({ userId: user.id, email: user.email }),
        });

        if (createWalletResponse.ok) {
          const walletData = await createWalletResponse.json();
          walletId = walletData.wallet.walletId;
        } else {
          return NextResponse.json({ error: "Failed to create wallet. Please try again." }, { status: 500 });
        }
      } catch (walletError) {
        console.error("Wallet creation error:", walletError);
        return NextResponse.json({ error: "Failed to initialize wallet" }, { status: 500 });
      }
    }

    const payResult = await payInvoice(invoiceId, walletId, user.id);

    if (!payResult.success) {
      return NextResponse.json({ error: payResult.error || "Payment failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, txHash: payResult.txHash });
  } catch (error: any) {
    console.error("Pay invoice API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process payment" }, { status: 500 });
  }
}
