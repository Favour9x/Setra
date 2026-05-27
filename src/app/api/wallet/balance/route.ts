import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/payments";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

// Simple 30-second in-memory balance cache
interface CacheEntry {
  balances: any;
  timestamp: number;
}

const balanceCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30000; // 30 seconds

export async function POST(request: NextRequest) {
  try {
    const { walletId } = await request.json();

    if (!walletId) {
      return NextResponse.json(
        { error: "Wallet ID is required" },
        { status: 400 }
      );
    }

    // Check in-memory cache first to avoid repeated slow API roundtrips
    const cached = balanceCache[walletId];
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      console.log(`⚡ Balance Cache Hit for wallet ${walletId} (TTL remaining: ${Math.round((CACHE_TTL_MS - (now - cached.timestamp)) / 1000)}s)`);
      return NextResponse.json({
        success: true,
        balances: cached.balances,
        cached: true
      });
    }

    // Authenticate the user using cookies
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Fetch the user's profile and check wallet ownership
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to verify wallet ownership" },
        { status: 500 }
      );
    }

    if (profile.wallet_id !== walletId) {
      return NextResponse.json(
        { error: "Wrong user" },
        { status: 403 }
      );
    }

    // Fetch fresh balance from Circle
    console.log(`🔄 Fetching fresh balance from Circle for wallet ${walletId}...`);
    const balances = await getBalance(walletId);
    
    console.log("================== MAPPED BALANCES TO FRONTEND ==================");
    console.log(JSON.stringify(balances, null, 2));
    console.log("================================================================");

    // Cache the fresh results
    balanceCache[walletId] = {
      balances,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      balances,
      cached: false
    });
  } catch (error: any) {
    console.error("Balance fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
