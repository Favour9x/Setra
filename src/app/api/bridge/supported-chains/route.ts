import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getSupportedChains } = await import("@/lib/bridge/service");
    const chains = getSupportedChains();
    return NextResponse.json({ chains });
  } catch (error: any) {
    console.error("Bridge supported-chains error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch supported chains" },
      { status: 500 }
    );
  }
}
