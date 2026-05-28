import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getBridgeWalletAddress } = await import("@/lib/bridge/service");
    const address = getBridgeWalletAddress();
    return NextResponse.json({ address });
  } catch (error: any) {
    console.error("Bridge address error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get bridge wallet address" },
      { status: 500 }
    );
  }
}
