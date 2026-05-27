import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase credentials not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users
    const { data: allUsers, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, wallet_id, created_at");

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch users: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const totalUsers = allUsers?.length || 0;
    const usersWithoutWallets = allUsers?.filter((u) => !u.wallet_id) || [];
    const usersWithWallets = allUsers?.filter((u) => u.wallet_id) || [];

    return NextResponse.json({
      success: true,
      totalUsers,
      usersWithWallets: usersWithWallets.length,
      usersWithoutWallets: usersWithoutWallets.length,
      usersNeedingMigration: usersWithoutWallets.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check wallets" },
      { status: 500 }
    );
  }
}
