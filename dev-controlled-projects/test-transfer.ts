import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

async function main() {
  console.log("🚀 Circle Wallet Transfer Test\n");

  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  const walletId = process.env.CIRCLE_WALLET_ID;
  const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;

  if (!entitySecret || !walletSetId || !walletId || !walletAddress) {
    console.error("❌ Missing required environment variables");
    console.log("Required: CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_SET_ID, CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS");
    process.exit(1);
  }

  console.log(`Using existing wallet: ${walletAddress}\n`);

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: entitySecret,
  });

  // Step 1: Check wallet balance and available tokens
  console.log("Step 1: Checking wallet balance and available tokens...");
  const balanceCheckResponse = await client.getWalletTokenBalance({
    id: walletId,
  });

  console.log("Available tokens in wallet:");
  const tokenBalances = balanceCheckResponse.data?.tokenBalances || [];
  tokenBalances.forEach((balance: any) => {
    console.log(`   ${balance.token?.symbol}: ${balance.amount}`);
    console.log(`      Token Address: ${balance.token?.tokenAddress || 'N/A'}`);
    console.log(`      Token ID: ${balance.token?.id || 'N/A'}`);
  });

  // Find USDC token
  const usdcBalance = tokenBalances.find(
    (b: any) => b.token?.symbol === "USDC"
  );

  if (!usdcBalance) {
    console.error("\n❌ USDC token not found in wallet.");
    console.log("Please ensure you requested USDC from the faucet.");
    console.log("Available tokens:", tokenBalances.map((b: any) => b.token?.symbol).join(", "));
    process.exit(1);
  }

  // Use token address if available, otherwise use token ID
  const usdcTokenAddress = usdcBalance.token?.tokenAddress || usdcBalance.token?.id;
  const usdcAmount = parseFloat(usdcBalance.amount);

  console.log(`\n✅ Found USDC: ${usdcAmount} USDC`);
  console.log(`   Token Address: ${usdcTokenAddress}\n`);

  if (usdcAmount < 5) {
    console.error(`❌ Insufficient USDC balance. Need 5 USDC, have ${usdcAmount} USDC`);
    process.exit(1);
  }

  // Step 2: Create second wallet
  console.log("Step 2: Creating second wallet...");
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

  // Step 3: Send 5 USDC to second wallet
  console.log("Step 3: Sending 5 USDC to second wallet...");
  
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

  // Step 4: Poll until COMPLETE
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

  // Step 5: Get balances for both wallets
  console.log("Step 5: Fetching wallet balances...\n");

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

  console.log("✅ Transfer test complete!\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
