import { NextRequest, NextResponse } from "next/server";
import { createEmbeddedWallet } from "@/lib/circle/client";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  console.log("🔵 /api/wallet/create - Request received");
  
  try {
    // Step 1: Initialize Supabase with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ /api/wallet/create - SUPABASE CONFIG ERROR: Missing URL or Service Role Key");
      return NextResponse.json(
        { error: "Internal Supabase configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });
    console.log("✅ /api/wallet/create - Supabase service role client initialized successfully");

    // Step 2: Get authenticated user from session cookies
    const authSupabase = await createServerSupabase();
    const { data: { session } } = await authSupabase.auth.getSession();

    if (!session) {
      console.log("❌ /api/wallet/create - Unauthorized: No session");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log("✅ /api/wallet/create - User authenticated:", userId);

    // Step 3: Query profiles table for existing wallet_id
    console.log("🔍 /api/wallet/create - Checking Supabase profiles for existing wallet_id for user:", userId);
    
    let profile = null;
    let fetchError = null;

    // Try service role client first
    const serviceRoleRes = await supabase
      .from("profiles")
      .select("wallet_id, wallet_address, email")
      .eq("id", userId)
      .maybeSingle();

    if (serviceRoleRes.error) {
      console.warn("⚠️ /api/wallet/create - Service role fetch failed, falling back to authenticated client:", serviceRoleRes.error.message);
      const authRes = await authSupabase
        .from("profiles")
        .select("wallet_id, wallet_address, email")
        .eq("id", userId)
        .maybeSingle();
      
      profile = authRes.data;
      fetchError = authRes.error;
    } else {
      profile = serviceRoleRes.data;
    }

    if (fetchError) {
      console.error("❌ /api/wallet/create - Database error checking profile:", fetchError);
    } else {
      console.log("📊 /api/wallet/create - Profile query result:", profile);
    }

    // Step 4: If wallet exists, return immediately
    if (profile?.wallet_id) {
      console.log("✅ /api/wallet/create - EXISTING WALLET FOUND in Supabase: returning existing wallet:", profile.wallet_id);
      return NextResponse.json({
        success: true,
        wallet: {
          id: profile.wallet_id,
          address: profile.wallet_address,
          walletId: profile.wallet_id,
          walletAddress: profile.wallet_address,
          blockchain: "ARC-TESTNET",
        },
      });
    }

    // Step 5: Only if wallet_id is null, create new Circle wallet
    console.log("🆕 /api/wallet/create - No wallet found, creating new Circle wallet...");
    const wallet = await createEmbeddedWallet(userId);
    console.log("✅ /api/wallet/create - Circle wallet created successfully");
    console.log("📍 /api/wallet/create - New Wallet ID:", wallet.walletId);
    console.log("📍 /api/wallet/create - New Wallet Address:", wallet.walletAddress);

    // Step 6: Save wallet to Supabase
    console.log("💾 /api/wallet/create - Saving wallet to Supabase profiles table...");
    let updateError = null;
    
    // Try service role client first
    const serviceRoleUpdate = await supabase
      .from("profiles")
      .update({
        wallet_id: wallet.walletId,
        wallet_address: wallet.walletAddress,
      })
      .eq("id", userId);

    if (serviceRoleUpdate.error) {
      console.warn("⚠️ /api/wallet/create - Service role update failed, falling back to authenticated client:", serviceRoleUpdate.error.message);
      const authUpdate = await authSupabase
        .from("profiles")
        .update({
          wallet_id: wallet.walletId,
          wallet_address: wallet.walletAddress,
        })
        .eq("id", userId);
      
      updateError = authUpdate.error;
    } else {
      console.log("✅ /api/wallet/create - Service role update succeeded");
    }

    if (updateError) {
      console.error("❌ /api/wallet/create - CRITICAL: Failed to save wallet to Supabase profiles:", updateError);
      return NextResponse.json({
        success: false,
        error: "Wallet created but failed to save to database: " + updateError.message,
        wallet: {
          walletId: wallet.walletId,
          walletAddress: wallet.walletAddress,
          blockchain: wallet.blockchain,
        },
      }, { status: 500 });
    }

    console.log("✅ /api/wallet/create - SUCCESS: Wallet saved successfully:", wallet.walletId);

    // Step 7: Return wallet
    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.walletId,
        address: wallet.walletAddress,
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress,
        blockchain: wallet.blockchain,
      },
    });
  } catch (error: any) {
    console.error("❌ /api/wallet/create - FATAL ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallet" },
      { status: 500 }
    );
  }
}
