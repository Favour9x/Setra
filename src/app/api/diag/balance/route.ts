import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const steps: Record<string, any> = {};
  
  try {
    // Step 1: Auth
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    steps.auth = { authenticated: !!session, userId: session?.user?.id };
    
    if (!session) {
      return NextResponse.json({ steps, error: "Unauthorized" });
    }

    // Step 2: Read profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address, email, username")
      .eq("id", session.user.id)
      .maybeSingle();
    
    steps.profile = { found: !!profile, wallet_id: profile?.wallet_id, wallet_address: profile?.wallet_address, error: profileError?.message };

    // Step 3: Try wallet lookup on Circle
    const { getWalletById, createWalletsForUser, getWalletBalanceForBlockchain, requestFaucetFunds } = await import("@/lib/circle/client");
    
    let walletId = profile?.wallet_id || null;
    let walletExists = false;
    
    if (walletId) {
      try {
        const walletResp = await getWalletById(walletId);
        walletExists = !!walletResp.data?.wallet?.id;
        steps.walletLookup = { walletId, exists: walletExists, address: walletResp.data?.wallet?.address, blockchain: walletResp.data?.wallet?.blockchain };
      } catch (err: any) {
        steps.walletLookup = { walletId, exists: false, error: err.message };
      }
    } else {
      steps.walletLookup = { walletId: null, exists: false, reason: "No wallet_id in profile" };
    }

    // Step 4: Create wallet if needed
    if (!walletExists) {
      try {
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const newWallets = await createWalletsForUser(session.user.id);
        steps.walletCreation = { success: newWallets.length > 0, walletId: newWallets[0]?.walletId, address: newWallets[0]?.walletAddress, blockchain: newWallets[0]?.blockchain };
        if (newWallets.length > 0) {
          walletId = newWallets[0].walletId;
          await adminSupabase.from("profiles").update({ wallet_id: walletId, wallet_address: newWallets[0].walletAddress }).eq("id", session.user.id);
        }
      } catch (err: any) {
        steps.walletCreation = { success: false, error: err.message };
        return NextResponse.json({ steps, error: "Wallet creation failed" });
      }
    }

    // Step 5: Get balance
    let currentBalance = 0;
    if (walletId) {
      try {
        const balances = await getWalletBalanceForBlockchain(walletId);
        const usdc = balances.find((b: any) => b.symbol?.toUpperCase() === "USDC");
        currentBalance = parseFloat(usdc?.amount || "0");
        steps.balance = { tokensFound: balances.length, usdcAmount: usdc?.amount || "0", allTokens: balances };
      } catch (err: any) {
        steps.balance = { error: err.message };
      }
    }

    // Step 6: Try faucet if balance is 0 and wallet exists
    if (walletExists && currentBalance === 0 && steps.walletLookup?.address) {
      try {
        await requestFaucetFunds(steps.walletLookup.address, steps.walletLookup.blockchain);
        steps.faucet = { success: true, address: steps.walletLookup.address, blockchain: steps.walletLookup.blockchain, message: "Faucet request sent" };
      } catch (err: any) {
        steps.faucet = { success: false, address: steps.walletLookup.address, blockchain: steps.walletLookup.blockchain, error: err.message };
      }
    } else {
      steps.faucet = { skipped: true, reason: walletExists ? (currentBalance > 0 ? "Balance already positive" : "No wallet address") : "No wallet" };
    }

    return NextResponse.json({ steps, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, steps });
  }
}
