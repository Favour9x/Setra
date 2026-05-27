import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user session
    const authSupabase = await createServerSupabase();
    const { data: { session } } = await authSupabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawUsername = searchParams.get("username");

    if (!rawUsername) {
      return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
    }

    // Strip @ if present and normalize
    let cleanUsername = rawUsername.trim();
    if (cleanUsername.startsWith("@")) {
      cleanUsername = cleanUsername.slice(1);
    }
    cleanUsername = cleanUsername.toLowerCase().trim();

    if (!cleanUsername) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // 2. Query database using service role (to bypass RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ /api/user/resolve - Supabase config missing");
      return NextResponse.json(
        { error: "Internal database configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("wallet_address, username")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error(`❌ Error looking up username ${cleanUsername}:`, error);
      return NextResponse.json({ error: "Database error resolving username" }, { status: 500 });
    }

    if (!profile || !profile.wallet_address) {
      return NextResponse.json({
        success: true,
        found: false,
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      username: profile.username,
      walletAddress: profile.wallet_address,
    });
  } catch (error: any) {
    console.error("❌ Resolution API fatal error:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve username" }, { status: 500 });
  }
}
