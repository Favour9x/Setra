import { createClient } from "@supabase/supabase-js";

/**
 * Resolves a recipient username or wallet address to a valid wallet address.
 * Matches client-side RecipientInput component's detection logic:
 * - If input starts with @ or contains no 0x prefix → treat as username
 * - If input starts with 0x → treat as wallet address
 */
export async function resolveRecipientAddress(recipientInput: string): Promise<string> {
  const trimmed = recipientInput.trim();
  
  // Detection logic
  const isUsername = trimmed.startsWith("@") || !trimmed.toLowerCase().startsWith("0x");

  if (!isUsername) {
    // Treat as wallet address
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return trimmed;
    }
    throw new Error("Invalid wallet address");
  }

  // Treat as username
  let cleanUsername = trimmed;
  if (cleanUsername.startsWith("@")) {
    cleanUsername = cleanUsername.slice(1);
  }
  cleanUsername = cleanUsername.toLowerCase().trim();

  if (!cleanUsername) {
    throw new Error("Invalid username");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Internal database configuration error");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (error) {
    console.error(`❌ resolveRecipientAddress - Supabase error for username ${cleanUsername}:`, error);
    throw new Error("Database error resolving username");
  }

  if (!profile || !profile.wallet_address) {
    throw new Error("Recipient not found on Setra");
  }

  return profile.wallet_address;
}
