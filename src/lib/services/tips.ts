import { createClient } from "@supabase/supabase-js";
import { getAdminSupabase, insertLedgerTransaction } from "@/lib/services/ledger";
import { createNotification } from "@/lib/services/notification";
import { executePayment } from "@/lib/payments";

export interface TipsPage {
  id: string;
  user_id: string;
  title: string;
  creator_username: string;
  recipient_address: string;
  active: boolean;
  goal_title: string | null;
  goal_amount: number | null;
  raised_amount: number;
  bronze_amount: number | null;
  silver_amount: number | null;
  gold_amount: number | null;
  created_at: string;
}

export interface TipMessage {
  id: string;
  payment_link_id: string;
  sender_address: string;
  sender_username: string | null;
  amount: number;
  message: string | null;
  tier_label: string | null;
  created_at: string;
}

const adminClient = () => getAdminSupabase();

function getTierLabel(amount: number, page: TipsPage): string | null {
  if (page.gold_amount && amount >= page.gold_amount) return "Gold";
  if (page.silver_amount && amount >= page.silver_amount) return "Silver";
  if (page.bronze_amount && amount >= page.bronze_amount) return "Bronze";
  return null;
}

export async function fetchUserTipsPage(userId: string): Promise<TipsPage | null> {
  const client = adminClient();
  const { data } = await client
    .from("payment_links")
    .select("*")
    .eq("user_id", userId)
    .eq("is_tips_page", true)
    .maybeSingle();
  return data as TipsPage | null;
}

export async function fetchTipsPageByUsername(username: string): Promise<TipsPage | null> {
  const client = adminClient();
  const { data } = await client
    .from("payment_links")
    .select("*")
    .eq("creator_username", username.toLowerCase())
    .eq("is_tips_page", true)
    .maybeSingle();
  return data as TipsPage | null;
}

export async function createTipsPage(
  userId: string,
  title: string,
  username: string,
  recipientAddress: string,
  goalTitle?: string,
  goalAmount?: number,
  bronzeAmount?: number,
  silverAmount?: number,
  goldAmount?: number
): Promise<TipsPage> {
  const client = adminClient();
  const { data, error } = await client
    .from("payment_links")
    .insert({
      user_id: userId,
      title,
      creator_username: username.toLowerCase(),
      recipient_address: recipientAddress,
      currency: "USDC",
      active: true,
      is_tips_page: true,
      goal_title: goalTitle || null,
      goal_amount: goalAmount || null,
      raised_amount: 0,
      bronze_amount: bronzeAmount || null,
      silver_amount: silverAmount || null,
      gold_amount: goldAmount || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TipsPage;
}

export async function updateTipsPage(
  userId: string,
  updates: {
    title?: string;
    goal_title?: string | null;
    goal_amount?: number | null;
    bronze_amount?: number | null;
    silver_amount?: number | null;
    gold_amount?: number | null;
    active?: boolean;
  }
): Promise<void> {
  const client = adminClient();
  const { error } = await client
    .from("payment_links")
    .update(updates)
    .eq("user_id", userId)
    .eq("is_tips_page", true);
  if (error) throw error;
}

export async function processTipPayment(
  tipsPage: TipsPage,
  amount: number,
  senderAddress: string,
  senderUsername: string | null,
  message?: string,
  isManual?: boolean,
  walletId?: string
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  const client = adminClient();
  const tierLabel = getTierLabel(amount, tipsPage);

  if (!isManual) {
    if (!walletId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletId)) {
      return { success: false, error: "Invalid wallet ID. Please refresh and try again." };
    }
    const fromWalletId = walletId;
    const paymentResult = await executePayment({
      fromWalletId,
      toAddress: tipsPage.recipient_address,
      amount: String(amount),
      type: "USDC",
    });
    if (!paymentResult.success) {
      return { success: false, error: paymentResult.error || "Payment failed" };
    }

    const txHash = paymentResult.txHash;

    await insertLedgerTransaction(client, {
      userId: tipsPage.user_id,
      recipientAddress: tipsPage.recipient_address,
      amount,
      type: "received",
      category: "Tips",
      status: "confirmed",
      txHash,
      metadata: { tipsPageId: tipsPage.id, tipsPageTitle: tipsPage.title, payerAddress: senderAddress, payerUsername: senderUsername },
    });

    const { error: msgError } = await client.from("tip_messages").insert({
      payment_link_id: tipsPage.id,
      sender_address: senderAddress,
      sender_username: senderUsername,
      amount,
      message: message || null,
      tier_label: tierLabel,
    });
    if (msgError) console.error("Failed to save tip message:", msgError);

    await client
      .from("payment_links")
      .update({ raised_amount: (tipsPage.raised_amount || 0) + amount })
      .eq("id", tipsPage.id);

    const displayName = senderUsername ? `@${senderUsername}` : `${senderAddress.substring(0, 6)}...${senderAddress.substring(senderAddress.length - 4)}`;
    await createNotification(
      tipsPage.user_id,
      "payment_received",
      "Tip Received!",
      `${displayName} sent you ${amount} USDC${message ? `: "${message.substring(0, 50)}"` : ""}`,
      { link: "/tips", amount, payerAddress: senderAddress, payerUsername: senderUsername }
    );

    return { success: true, txHash };
  } else {
    await insertLedgerTransaction(client, {
      userId: tipsPage.user_id,
      recipientAddress: tipsPage.recipient_address,
      amount,
      type: "received",
      category: "Tips",
      status: "pending",
      displayRecipient: senderUsername || senderAddress,
      metadata: { tipsPageId: tipsPage.id, tipsPageTitle: tipsPage.title, payerAddress: senderAddress, payerUsername: senderUsername, isManualAttempt: true },
    });

    const { error: msgError } = await client.from("tip_messages").insert({
      payment_link_id: tipsPage.id,
      sender_address: senderAddress,
      sender_username: senderUsername,
      amount,
      message: message || null,
      tier_label: tierLabel,
    });
    if (msgError) console.error("Failed to save tip message:", msgError);

    await client
      .from("payment_links")
      .update({ raised_amount: (tipsPage.raised_amount || 0) + amount })
      .eq("id", tipsPage.id);

    return { success: true };
  }
}

export async function fetchTipMessages(
  paymentLinkId: string,
  limit = 50,
  offset = 0
): Promise<TipMessage[]> {
  const client = adminClient();
  const { data } = await client
    .from("tip_messages")
    .select("*")
    .eq("payment_link_id", paymentLinkId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data || []) as TipMessage[];
}

export async function fetchTopSupporters(paymentLinkId: string): Promise<{ sender_address: string; sender_username: string | null; total_amount: number }[]> {
  const client = adminClient();
  try {
    const { data } = await client.rpc("get_top_supporters", { p_payment_link_id: paymentLinkId });
    if (data) return data as any;
  } catch (e) {}
  const { data: messages } = await client
    .from("tip_messages")
    .select("sender_address, sender_username, amount")
    .eq("payment_link_id", paymentLinkId);
  const grouped: Record<string, { sender_address: string; sender_username: string | null; total_amount: number }> = {};
  for (const m of messages || []) {
    const key = m.sender_username || m.sender_address;
    if (!grouped[key]) grouped[key] = { sender_address: m.sender_address, sender_username: m.sender_username, total_amount: 0 };
    grouped[key].total_amount += Number(m.amount || 0);
  }
  return Object.values(grouped).sort((a, b) => b.total_amount - a.total_amount).slice(0, 10);
}

export async function fetchTipsAnalytics(userId: string): Promise<{
  thisWeekTotal: number;
  lastWeekTotal: number;
  bestTipper: { address: string; username: string | null; total: number } | null;
  bestDay: string | null;
}> {
  const client = adminClient();
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);

  const { data: tips } = await client
    .from("payment_links")
    .select("id, title")
    .eq("user_id", userId)
    .eq("is_tips_page", true);

  if (!tips || tips.length === 0) {
    return { thisWeekTotal: 0, lastWeekTotal: 0, bestTipper: null, bestDay: null };
  }

  const linkIds = tips.map(t => t.id);

  const { data: thisWeekMessages } = await client
    .from("tip_messages")
    .select("amount")
    .in("payment_link_id", linkIds)
    .gte("created_at", thisWeekStart.toISOString());

  const { data: lastWeekMessages } = await client
    .from("tip_messages")
    .select("amount")
    .in("payment_link_id", linkIds)
    .gte("created_at", lastWeekStart.toISOString())
    .lt("created_at", lastWeekEnd.toISOString());

  const thisWeekTotal = (thisWeekMessages || []).reduce((s, m) => s + Number(m.amount || 0), 0);
  const lastWeekTotal = (lastWeekMessages || []).reduce((s, m) => s + Number(m.amount || 0), 0);

  const { data: allMessages } = await client
    .from("tip_messages")
    .select("sender_address, sender_username, amount")
    .in("payment_link_id", linkIds);

  const tipperTotals: Record<string, { address: string; username: string | null; total: number }> = {};
  const dayTotals: Record<string, number> = {};
  for (const msg of allMessages || []) {
    const key = msg.sender_username || msg.sender_address;
    if (!tipperTotals[key]) tipperTotals[key] = { address: msg.sender_address, username: msg.sender_username, total: 0 };
    tipperTotals[key].total += Number(msg.amount || 0);
  }

  const bestTipper = Object.values(tipperTotals).sort((a, b) => b.total - a.total)[0] || null;

  return { thisWeekTotal, lastWeekTotal, bestTipper, bestDay: null };
}
