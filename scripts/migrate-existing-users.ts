/**
 * One-time migration script to create Circle wallets for existing users
 * 
 * Usage:
 *   npm run migrate:users
 */

async function migrateUsers() {
  console.log("🚀 Starting user wallet migration...\n");

  try {
    console.log("📋 Fetching users and creating wallets...");
    console.log("⏳ This may take a while (1 second per user to avoid rate limits)\n");

    const response = await fetch("http://localhost:3000/api/admin/migrate-wallets", {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Migration failed:", error.error || "Unknown error");
      process.exit(1);
    }

    const result = await response.json();

    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary");
    console.log("=".repeat(60));
    console.log(`Total users processed: ${result.processed}`);
    console.log(`✅ Successful: ${result.successful}`);
    console.log(`❌ Failed: ${result.failed}`);

    if (result.failures && result.failures.length > 0) {
      console.log("\n❌ Failed users:");
      result.failures.forEach((failure: any) => {
        console.log(`  - ${failure.email}`);
        console.log(`    Error: ${failure.error}`);
      });
    }

    console.log("\n✅ Migration complete!");
    
    if (result.successful > 0) {
      console.log("\n💡 Run 'npm run check:wallets' to verify all users have wallets.");
    }
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.log("\n💡 Make sure the dev server is running: npm run dev");
    process.exit(1);
  }
}

migrateUsers();
