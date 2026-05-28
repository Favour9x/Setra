import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getSupportedChains } = await import("@/lib/bridge/service");
    const chains = getSupportedChains();
    const mapped = chains.map((c) => ({
      chain: c.chain,
      name: c.name,
      title: c.title || c.name,
      isTestnet: c.isTestnet,
      type: c.type,
      nativeCurrency: c.nativeCurrency,
    }));
    return NextResponse.json({ chains: mapped });
  } catch (error: any) {
    console.error("Bridge supported-chains error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch supported chains" },
      { status: 500 }
    );
  }
}
