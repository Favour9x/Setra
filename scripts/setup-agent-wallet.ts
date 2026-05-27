import { createEmbeddedWallet } from "../src/lib/circle/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function setup() {
  console.log("🤖 [Circle Agent Stack]: Provisioning separate Agent Wallet...");
  try {
    const wallet = await createEmbeddedWallet("circle-agent-system");
    console.log("✅ Circle Agent Wallet created successfully!");
    console.log("Wallet ID:", wallet.walletId);
    console.log("Wallet Address:", wallet.walletAddress);

    const envPath = path.join(process.cwd(), ".env.local");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    // Append credentials to .env.local if not already present
    if (!envContent.includes("CIRCLE_AGENT_WALLET_ID")) {
      envContent += `\n# Circle Agent Stack Credentials\nCIRCLE_AGENT_WALLET_ID=${wallet.walletId}\nCIRCLE_AGENT_WALLET_ADDRESS=${wallet.walletAddress}\n`;
      fs.writeFileSync(envPath, envContent, "utf-8");
      console.log("📝 Saved Agent Wallet ID & Address to .env.local!");
    } else {
      console.log("ℹ️ Agent Wallet ID already configured in .env.local");
    }
  } catch (error) {
    console.error("❌ Failed to setup Agent Wallet:", error);
  }
}

setup();
