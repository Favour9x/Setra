import { generateEntitySecret, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔐 Registering Entity Secret with Circle\n");

  // Generate entity secret
  const entitySecret = generateEntitySecret();
  
  console.log("Entity Secret (save this securely):");
  console.log(entitySecret);
  console.log("\n");

  // Register with Circle
  console.log("Registering with Circle API...\n");
  
  try {
    const response = await registerEntitySecretCiphertext({
      apiKey: process.env.CIRCLE_API_KEY ?? "",
      entitySecret: entitySecret,
      recoveryFileDownloadPath: "./output",
    });

    console.log("✅ Registration successful!");
    console.log("Response:", JSON.stringify(response.data, null, 2));

    // Save to .env
    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.readFileSync(envPath, "utf-8");
    
    if (envContent.includes("CIRCLE_ENTITY_SECRET=")) {
      envContent = envContent.replace(/CIRCLE_ENTITY_SECRET=.*/, `CIRCLE_ENTITY_SECRET=${entitySecret}`);
    } else {
      envContent += `\nCIRCLE_ENTITY_SECRET=${entitySecret}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log("\n✅ Entity secret saved to .env");
    console.log("\nYou can now run: node --env-file=.env --import=tsx create-wallet.ts");
    
  } catch (error: any) {
    console.error("❌ Registration failed:", error.message);
    console.error("Full error:", error);
    
    console.log("\n⚠️  Manual registration required:");
    console.log("1. Go to: https://console.circle.com/");
    console.log("2. Navigate to: Developer Settings → Entity Secret");
    console.log("3. Register this entity secret:");
    console.log(`   ${entitySecret}`);
    console.log("\n4. Then add it to your .env file:");
    console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}`);
  }
}

main().catch(console.error);
