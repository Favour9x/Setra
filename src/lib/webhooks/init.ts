import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export async function registerWebhookSubscription(endpoint: string): Promise<{ subscriptionId: string | null; error?: string }> {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("❌ Circle API credentials not configured for webhook registration");
    return null;
  }

  try {
    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

    const response = await client.createSubscription({
      endpoint,
    });

    const subscriptionId = response.data?.id;
    if (subscriptionId) {
      console.log(`✅ Webhook subscription created: ${subscriptionId} → ${endpoint}`);
      return { subscriptionId };
    }

    console.error("❌ No subscription ID in response");
    return { subscriptionId: null, error: "No subscription ID in response" };
  } catch (err: any) {
    const errorData = err?.response?.data || err?.message || err;
    const errorStr = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
    console.error("❌ Failed to create webhook subscription:", errorStr);
    return { subscriptionId: null, error: errorStr };
  }
}

export async function listWebhookSubscriptions() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) return [];

  try {
    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
    const response: any = await client.listSubscriptions();
    return response.data?.subscriptions || response.data || [];
  } catch (err) {
    console.error("Failed to list webhook subscriptions:", err);
    return [];
  }
}

export async function deleteWebhookSubscription(subscriptionId: string) {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) return;

  try {
    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
    await (client as any).deleteSubscription(subscriptionId as any);
    console.log(`✅ Webhook subscription deleted: ${subscriptionId}`);
  } catch (err) {
    console.error(`Failed to delete subscription ${subscriptionId}:`, err);
  }
}
