import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase admin credentials in process env.");
}

// Admin client to bypass RLS policies during system notification inserts
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Creates a new notification record in the database for the given user.
 */
export async function createNotification(
  userId: string,
  type: 'payment_received' | 'payment_sent' | 'invoice_created' | 'invoice_paid' | 'subscription_renewed' | 'workflow_executed' | 'payment_request',
  title: string,
  message: string,
  metadata: any = {}
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Error in createNotification:", error);
    return null;
  }
}

/**
 * Resolves a user ID to a friendly handle (e.g. '@alice', '0x1234...5678', or email prefix)
 */
export async function getUserHandle(userId: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("username, wallet_address, email")
      .eq("id", userId)
      .single();

    if (error || !data) return "User";
    if (data.username) return `@${data.username}`;
    if (data.wallet_address) {
      const addr = data.wallet_address;
      return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    }
    return data.email ? data.email.split("@")[0] : "User";
  } catch {
    return "User";
  }
}

/**
 * Resolves a wallet address to a friendly handle (e.g. '@alice' or shortened address)
 */
export async function getUserHandleByWallet(address: string): Promise<string> {
  if (!address) return "unknown";
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("username, email")
      .eq("wallet_address", address)
      .single();

    if (error || !data) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    if (data.username) return `@${data.username}`;
    return data.email ? data.email.split("@")[0] : `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  } catch {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
