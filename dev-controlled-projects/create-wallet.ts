import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("🚀 Circle Developer-Controlled Wallets Setup\n");

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check for entity secret
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  if (!entitySecret) {
    console.error("❌ CIRCLE_ENTITY_SECRET not found in .env");
    console.log("\nPlease add your entity secret to .env:");
    console.log("CIRCLE_ENTITY_SECRET=your_entity_secret_here");
    process.exit(1);
  }

  console.log("✅ Using entity secret from .env\n");

  // Initialize client with entity secret
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: entitySecret,
  });

  // Step 1: Create wallet set
  console.log("Step 1: Creating wallet set 'ArcPayWallets'...");
  const walletSetResponse = await client.createWalletSet({
    name: "ArcPayWallets",
  });

  const walletSet = walletSetResponse.data?.walletSet;
  if (!walletSet?.id) {
    throw new Error("Wallet set creation failed: no ID returned");
  }

  const walletSetId = walletSet.id;
  console.log(`✅ Wallet set created: ${walletSetId}\n`);

  // Step 2: Create first wallet
  console.log("Step 2: Creating EOA wallet on ARC-TESTNET...");
  const walletResponse = await client.createWallets({
    walletSetId: walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
  });

  const wallet = walletResponse.data?.wallets?.[0];
  if (!wallet) {
    throw new Error("Wallet creation failed");
  }

  const walletId = wallet.id;
  const walletAddress = wallet.address;
  const blockchain = wallet.blockchain;

  console.log(`✅ Wallet created!`);
  console.log(`   Wallet ID: ${walletId}`);
  console.log(`   Address: ${walletAddress}`);
  console.log(`   Blockchain: ${blockchain}\n`);

  // Step 3: Save to .env
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  if (!envContent.includes("CIRCLE_WALLET_SET_ID=")) {
    envContent += `\nCIRCLE_WALLET_SET_ID=${walletSetId}`;
  }
  if (!envContent.includes("CIRCLE_WALLET_ADDRESS=")) {
    envContent += `\nCIRCLE_WALLET_ADDRESS=${walletAddress}`;
  }
  if (!envContent.includes("CIRCLE_WALLET_BLOCKCHAIN=")) {
    envContent += `\nCIRCLE_WALLET_BLOCKCHAIN=${blockchain}`;
  }
  if (!envContent.includes("CIRCLE_WALLET_ID=")) {
    envContent += `\nCIRCLE_WALLET_ID=${walletId}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Wallet info saved to .env\n");

  // Step 4: Save wallet-info.json
  const walletInfo = {
    walletSetId,
    walletId,
    walletAddress,
    blockchain,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outputDir, "wallet-info.json"),
    JSON.stringify(walletInfo, null, 2)
  );

  console.log("✅ wallet-info.json saved to output/ folder\n");

  // Step 5: Pause for funding
  console.log("⏸️  PAUSE: Please fund your wallet via faucet");
  console.log(`   Address: ${walletAddress}`);
  console.log(`   Faucet: https://faucet.circle.com/`);
  console.log(`   Request USDC on ARC-TESTNET\n`);

  await question("Press Enter after funding the wallet...");
  console.log("\n");

  // Step 6: Create second wallet
  console.log("Step 6: Creating second wallet...");
  const wallet2Response = await client.createWallets({
    walletSetId: walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
  });

  const wallet2 = wallet2Response.data?.wallets?.[0];
  if (!wallet2) {
    throw new Error("Failed to create second wallet");
  }

  const wallet2Id = wallet2.id;
  const wallet2Address = wallet2.address;

  console.log(`✅ Second wallet created!`);
  console.log(`   Wallet ID: ${wallet2Id}`);
  console.log(`   Address: ${wallet2Address}\n`);

  // Step 7: Check wallet balance and available tokens
  console.log("Step 7: Checking wallet balance and available tokens...");
  const balanceCheckResponse = await client.getWalletTokenBalance({
    id: walletId,
  });

  console.log("Available tokens in wallet:");
  const tokenBalances = balanceCheckResponse.data?.tokenBalances || [];
  tokenBalances.forEach((balance: any) => {
    console.log(`   ${balance.token?.symbol}: ${balance.amount}`);
  });

  // Find USDC token
  const usdcBalance = tokenBalances.find(
    (b: any) => b.token?.symbol === "USDC"
  );

  if (!usdcBalance) {
    console.error("\n❌ USDC token not found in wallet.");
    console.log("Please ensure you requested USDC from the faucet.");
    console.log("Available tokens:", tokenBalances.map((b: any) => b.token?.symbol).join(", "));
    rl.close();
    process.exit(1);
  }

  const usdcAmount = parseFloat(usdcBalance.amount);

  console.log(`\n✅ Found USDC: ${usdcAmount} USDC\n`);

  if (usdcAmount < 5) {
    console.error(`❌ Insufficient USDC balance. Need 5 USDC, have ${usdcAmount} USDC`);
    rl.close();
    process.exit(1);
  }

  // Step 8: Send 5 USDC to second wallet
  console.log("Step 8: Sending 5 USDC to second wallet...");
  
  // For native USDC on ARC-TESTNET, we don't specify tokenAddress
  const transferResponse = await client.createTransaction({
    walletId: walletId,
    blockchain: "ARC-TESTNET",
    destinationAddress: wallet2Address,
    amounts: ["5"],
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM",
      },
    },
  });

  const transactionId = transferResponse.data?.id;
  if (!transactionId) {
    throw new Error("Failed to create transfer transaction");
  }

  console.log(`✅ Transfer initiated: ${transactionId}`);
  console.log("   Polling for completion...\n");

  // Step 9: Poll until COMPLETE
  let transactionState = "INITIATED";
  while (transactionState !== "COMPLETE" && transactionState !== "FAILED") {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await client.getTransaction({
      id: transactionId,
    });

    transactionState = statusResponse.data?.transaction?.state || "UNKNOWN";
    console.log(`   Status: ${transactionState}`);

    if (transactionState === "FAILED") {
      console.error("Transaction details:", JSON.stringify(statusResponse.data, null, 2));
      throw new Error("Transaction failed");
    }
  }

  console.log("\n✅ Transfer complete!\n");

  // Step 10: Get balances for both wallets
  console.log("Step 10: Fetching wallet balances...\n");

  const balance1Response = await client.getWalletTokenBalance({
    id: walletId,
  });

  const balance2Response = await client.getWalletTokenBalance({
    id: wallet2Id,
  });

  const balance1 =
    balance1Response.data?.tokenBalances?.find(
      (b: any) => b.token?.symbol === "USDC"
    )?.amount || "0";
  const balance2 =
    balance2Response.data?.tokenBalances?.find(
      (b: any) => b.token?.symbol === "USDC"
    )?.amount || "0";

  console.log("📊 Final Balances:");
  console.log(`   Wallet 1 (${walletAddress}): ${balance1} USDC`);
  console.log(`   Wallet 2 (${wallet2Address}): ${balance2} USDC\n`);

  console.log("✅ Setup complete! All wallet info saved to output/ folder\n");

  rl.close();
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  rl.close();
  process.exit(1);
});
