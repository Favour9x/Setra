import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { parseAgentPrompt } from "@/lib/agents";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const agentResult = await parseAgentPrompt(user.id, prompt);
    return NextResponse.json(agentResult);
  } catch (error: any) {
    console.error("AI Agent prompt parser API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process agent command" }, { status: 500 });
  }
}
