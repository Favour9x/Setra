import { NextRequest, NextResponse } from "next/server";
import { parseIntent } from "@/lib/workflows/intent-parser";

// POST - Parse natural language intent into workflow configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent } = body;

    if (!intent) {
      return NextResponse.json({ error: "Missing intent" }, { status: 400 });
    }

    const parsed = parseIntent(intent);
    
    return NextResponse.json({ 
      success: true, 
      parsed,
      confidence: parsed.confidence,
      workflow_type: parsed.workflow_type,
      name: parsed.name,
      config: parsed.config,
      plain_english: parsed.plain_english
    });
  } catch (error: any) {
    console.error("Parse intent error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse intent" }, { status: 500 });
  }
}
