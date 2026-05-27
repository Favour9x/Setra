import { NextRequest, NextResponse } from "next/server";
import { fetchTipsPageByUsername, fetchTipMessages } from "@/lib/services/tips";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const page = await fetchTipsPageByUsername(username);
    if (!page) return NextResponse.json({ error: "Tips page not found" }, { status: 404 });

    const messages = await fetchTipMessages(page.id, limit, offset);

    return NextResponse.json({ success: true, messages, hasMore: messages.length >= limit });
  } catch (error: any) {
    console.error("Fetch messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
