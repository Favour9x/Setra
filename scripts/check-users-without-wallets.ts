/**
 * Quick check script to see how many users need wallet migration
 * 
 * Usage:
 *   npm run check:wallets
 */

async function checkUsers() {
  console.log("🔍 Checking users without wallets...\n");

  try {
    const response = await fetch("http://localhost:3000/api/admin/check-wallets");
    
    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Error:", error.error || "Failed to check wallets");
      process.exit(1);
    }

    const data = await response.json();

    console.log("📊 User Wallet Status");
    console.log("=".repeat(60));
    console.log(`Total users: ${data.totalUsers}`);
    console.log(`Users with wallets: ${data.usersWithWallets}`);
    console.log(`Users without wallets: ${data.usersWithoutWallets}`);
    console.log("=".repeat(60));

    if (data.usersNeedingMigration && data.usersNeedingMigration.length > 0) {
      console.log("\n👥 Users needing wallet migration:");
      data.usersNeedingMigration.forEach((user: any, index: number) => {
        const createdDate = new Date(user.createdAt).toLocaleDateString();
        console.log(`  ${index + 1}. ${user.email} (created: ${createdDate})`);
      });
      console.log(
        `\n💡 Run 'npm run migrate:users' to create wallets for these users.`
      );
    } else {
      console.log("\n✅ All users have wallets! No migration needed.");
    }
  } catch (error: any) {
    console.error("\n❌ Check failed:", error.message);
    console.log("\n💡 Make sure the dev server is running: npm run dev");
    process.exit(1);
  }
}

checkUsers();
