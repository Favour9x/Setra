import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

console.log("API Key:", apiKey ? "Present" : "Missing");
console.log("Entity Secret:", entitySecret ? "Present" : "Missing");

const sdk = initiateDeveloperControlledWalletsClient({
  apiKey: apiKey!,
  entitySecret: entitySecret,
});

console.log("\nSDK Methods:");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk)));

async function test() {
  try {
    const result = await sdk.createWalletSet({ name: "Test" });
    console.log("\nSuccess:", result.data);
  } catch (error: any) {
    console.log("\nError:", error.message);
    console.log("Error details:", error.response?.data || error);
  }
}

test();
