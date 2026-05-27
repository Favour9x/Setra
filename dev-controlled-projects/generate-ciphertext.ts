import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";

async function main() {
  console.log("🔐 Generating Entity Secret Ciphertext for Circle Console\n");

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey) {
    console.error("❌ CIRCLE_API_KEY not found in .env");
    process.exit(1);
  }

  if (!entitySecret) {
    console.error("❌ CIRCLE_ENTITY_SECRET not found in .env");
    process.exit(1);
  }

  console.log("Entity Secret:", entitySecret);
  console.log("\n");

  // Initialize client to access API
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: apiKey,
  });

  try {
    // Step 1: Fetch Circle's public key
    console.log("Step 1: Fetching Circle's public key...");
    const publicKeyResponse = await client.getPublicKey();
    
    const publicKey = publicKeyResponse.data?.publicKey;
    
    if (!publicKey) {
      throw new Error("Failed to fetch public key from Circle");
    }

    console.log("✅ Public key fetched\n");

    // Step 2: Encrypt the entity secret using the public key
    console.log("Step 2: Encrypting entity secret...");
    
    // Convert hex entity secret to buffer
    const entitySecretBuffer = Buffer.from(entitySecret, "hex");
    
    // The public key is already in PEM format
    const encryptedBuffer = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      entitySecretBuffer
    );

    // Convert to base64 ciphertext
    const ciphertext = encryptedBuffer.toString("base64");

    console.log("✅ Entity secret encrypted\n");
    console.log("=" .repeat(80));
    console.log("CIPHERTEXT (paste this into Circle Console):");
    console.log("=" .repeat(80));
    console.log(ciphertext);
    console.log("=" .repeat(80));
    console.log(`\nLength: ${ciphertext.length} characters\n`);
    console.log("📋 Instructions:");
    console.log("1. Go to: https://console.circle.com/");
    console.log("2. Navigate to: Developer Settings → Entity Secret");
    console.log("3. Paste the ciphertext above");
    console.log("4. Click 'Register Entity Secret'");
    console.log("\n");
    console.log("After registration, run: node --env-file=.env --import=tsx create-wallet.ts");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
