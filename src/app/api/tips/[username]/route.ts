import { NextRequest, NextResponse } from "next/server";
import { fetchTipsPageByUsername, fetchTipMessages, fetchTopSupporters } from "@/lib/services/tips";
import { createClient } from "@supabase/supabase-js";

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const page = await fetchTipsPageByUsername(username);

    if (!page) {
      return NextResponse.json({ error: "Tips page not found" }, { status: 404 });
    }

    const messages = await fetchTipMessages(page.id, 50);
    const topSupporters = await fetchTopSupporters(page.id);

    const client = adminClient();
    const { data: creatorProfile } = await client
      .from("profiles")
      .select("username, wallet_address")
      .eq("username", username.toLowerCase())
      .single();

    const { data: userProfile } = await client
      .from("user_profiles")
      .select("first_name, last_name, avatar")
      .eq("user_id", page.user_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      page,
      creator: {
        username: creatorProfile?.username || username,
        displayName: userProfile ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || username : username,
        avatar: userProfile?.avatar || null,
      },
      messages,
      topSupporters,
    });
  } catch (error: any) {
    console.error("Fetch tips page error:", error);
    return NextResponse.json({ error: "Failed to load tips page" }, { status: 500 });
  }
}
