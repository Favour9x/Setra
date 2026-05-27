import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchTipsAnalytics, fetchUserTipsPage, fetchTipMessages, fetchTopSupporters } from "@/lib/services/tips";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const page = await fetchUserTipsPage(session.user.id);
    const analytics = await fetchTipsAnalytics(session.user.id);

    let messages: any[] = [];
    let topSupporters: any[] = [];

    if (page) {
      messages = await fetchTipMessages(page.id, 20);
      topSupporters = await fetchTopSupporters(page.id);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, wallet_address")
      .eq("id", session.user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      page,
      analytics,
      messages,
      topSupporters,
      profile,
    });
  } catch (error: any) {
    console.error("Tips stats error:", error);
    return NextResponse.json({ error: "Failed to load tips stats" }, { status: 500 });
  }
}
