import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createEmbeddedWallet } from "@/lib/circle/client";

export async function POST() {
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

    // Get all users without wallets
    const { data: users, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email")
      .is("wallet_id", null);

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch users: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users need wallet migration",
        processed: 0,
        successful: 0,
        failed: 0,
      });
    }

    const results = {
      processed: users.length,
      successful: 0,
      failed: 0,
      failures: [] as Array<{ email: string; error: string }>,
    };

    // Process each user
    for (const user of users) {
      try {
        // Create Circle wallet
        const wallet = await createEmbeddedWallet(user.id);

        // Update Supabase profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            wallet_id: wallet.walletId,
            wallet_address: wallet.walletAddress,
          })
          .eq("id", user.id);

        if (updateError) {
          throw new Error(`Failed to update profile: ${updateError.message}`);
        }

        results.successful++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        results.failed++;
        results.failures.push({
          email: user.email,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration complete",
      ...results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}
