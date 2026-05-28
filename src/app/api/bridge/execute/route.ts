import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { fromChain, toChain, amount, recipientAddress } = await request.json();

    if (!fromChain || !toChain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: fromChain, toChain, amount" },
        { status: 400 }
      );
    }

    const { executeBridge } = await import("@/lib/bridge/service");
    const result = await executeBridge({
      fromChain,
      toChain,
      amount,
      recipientAddress: recipientAddress || undefined,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Bridge execute error:", error);
    return NextResponse.json(
      { error: error.message || "Bridge execution failed" },
      { status: 500 }
    );
  }
}
