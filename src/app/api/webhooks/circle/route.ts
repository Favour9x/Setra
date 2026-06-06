import { NextRequest, NextResponse } from "next/server";
import { verifyCircleSignature } from "@/lib/webhooks/verify";
import { handleCircleWebhook } from "@/lib/webhooks/handler";
import { listWebhookSubscriptions, registerWebhookSubscription } from "@/lib/webhooks/init";

const ALLOWED_IPS = new Set([
  "54.243.112.156",
  "100.24.191.35",
  "54.165.52.248",
  "54.87.106.46",
]);

async function processWebhook(body: string) {
  try {
    const payload = JSON.parse(body);
    await handleCircleWebhook(payload);
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-circle-signature");
  const keyId = request.headers.get("x-circle-key-id");
  const body = await request.text();

  // Respond 200 to all valid requests within 5s as Circle requires.
  // Actual processing happens asynchronously after response.
  const respondOk = () => NextResponse.json({ success: true });

  // Verification probe from Circle (during subscription creation).
  // May come with or without signature headers. Always accept.
  if (!signature || !keyId) {
    return respondOk();
  }

  // Probe with signature headers but no real key to verify
  if (body.includes("notificationType") && body.includes("webhooks.test")) {
    return respondOk();
  }

  // Verify the signature for real webhook notifications
  const isValid = await verifyCircleSignature(body, signature, keyId);
  if (!isValid) {
    console.error("❌ Invalid Circle webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Respond 200 immediately, then process in background
  const res = respondOk();
  processWebhook(body);
  return res;
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 200 });
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
"POST - Receive webhook notifications from Circle",

      "GET ?action=setup&endpoint=URL - register webhook subscription",

      "GET ?action=list - list existing subscriptions",
    ],
  });
}
