import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { fromChain, toChain, amount } = await request.json();

    if (!fromChain || !toChain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: fromChain, toChain, amount" },
        { status: 400 }
      );
    }

    const { estimateBridge } = await import("@/lib/bridge/service");
    const estimate = await estimateBridge({ fromChain, toChain, amount });

    return NextResponse.json({ estimate });
  } catch (error: any) {
    console.error("Bridge estimate error:", error);
    return NextResponse.json(
      { error: error.message || "Estimation failed" },
      { status: 500 }
    );
  }
}
