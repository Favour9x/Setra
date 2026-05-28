import { NextRequest, NextResponse } from "next/server";
import { verifyCircleSignature } from "@/lib/webhooks/verify";
import { handleCircleWebhook } from "@/lib/webhooks/handler";
import { listWebhookSubscriptions, registerWebhookSubscription } from "@/lib/webhooks/init";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-circle-signature");
  const keyId = request.headers.get("x-circle-key-id");

  if (!signature || !keyId) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const body = await request.text();

  const isValid = await verifyCircleSignature(body, signature, keyId);
  if (!isValid) {
    console.error("❌ Invalid Circle webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body);
    await handleCircleWebhook(payload);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "setup") {
    const endpoint = searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint param" }, { status: 400 });
    }

    const existing = await listWebhookSubscriptions();
    const alreadyRegistered = existing.some((s: any) => s.endpoint === endpoint);
    if (alreadyRegistered) {
      return NextResponse.json({ success: true, message: "Webhook already registered", subscriptions: existing });
    }

    const result = await registerWebhookSubscription(endpoint);
    if (!result.subscriptionId) {
      return NextResponse.json({ error: result.error || "Failed to register webhook" }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscriptionId: result.subscriptionId });
  }

  if (action === "list") {
    const subscriptions = await listWebhookSubscriptions();
    return NextResponse.json({ subscriptions });
  }

  return NextResponse.json({
    message: "Circle webhook endpoint",
    usage: [
      "POST — Receive webhook notifications from Circle",
      "GET ?action=setup&endpoint=URL — register webhook subscription",
      "GET ?action=list — list existing subscriptions",
    ],
  });
}
