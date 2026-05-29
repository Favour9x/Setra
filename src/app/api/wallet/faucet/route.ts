import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address")
      .eq("id", session.user.id)
      .single();

    if (!profile?.wallet_id) {
      return NextResponse.json({ error: "No wallet found. Create one first." }, { status: 400 });
    }

    const { getWalletById, requestFaucetFunds, getWalletBalanceForBlockchain } = await import("@/lib/circle/client");

    const walletResp = await getWalletById(profile.wallet_id);
    const wallet = walletResp.data?.wallet;
    if (!wallet) return NextResponse.json({ error: "Wallet not found on Circle" }, { status: 404 });

    const address = wallet.address;
    const blockchain = wallet.blockchain;

    let faucetResult: any = { attempted: true };
    try {
      await requestFaucetFunds(address, blockchain);
      faucetResult.success = true;
      faucetResult.message = `Faucet called for ${address} on ${blockchain}`;
    } catch (e: any) {
      faucetResult.success = false;
      faucetResult.error = e.message;
    }

    const balances = await getWalletBalanceForBlockchain(profile.wallet_id);
    const usdcBalance = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
    const balance = usdcBalance ? parseFloat(usdcBalance.amount) : 0;

    return NextResponse.json({
      faucetResult,
      balance,
      walletId: profile.wallet_id,
      walletAddress: address,
      blockchain,
      allBalances: balances,
      profileWalletId: profile.wallet_id,
      profileWalletAddress: profile.wallet_address,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
