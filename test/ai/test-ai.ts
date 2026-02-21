import { Database } from "./src/lib/db";
import { Env } from "./worker-configuration";
import { ulid } from "ulidx";

async function main() {
  console.log("Starting Dummy Data Injection...");

  const userId = "ai_test_user_id";
  const categoryIncomeId = ulid();
  const categoryFoodId = ulid();
  const categoryTransportId = ulid();

  console.log("To properly test this, we should hit the real local endpoints.");
  console.log("Please ensure your local dev server (bun run dev) is running.");
  console.log("\n--- INSTRUCTIONS FOR AI TESTING ---");
  console.log("Since 'bun run dev' isolates D1 and KV, we can't easily inject data without the app context.");
  console.log("Follow these steps to test the AI:");
  console.log("1. Look at the URL from your successful Google/Github login (e.g., http://localhost:8787/oauth/success?token=ey...)");
  console.log("2. Copy that token.");
  console.log("3. Run the following curl commands in a new terminal, replacing YOUR_TOKEN_HERE with the copied token:\n");
  
  const token = "YOUR_TOKEN_HERE";
  
  console.log("Create Income Category:");
  console.log(`curl -X POST http://localhost:8787/categories -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"name": "Gaji", "type": "income", "color": "#10B981", "icon": "💰"}'`);
  
  console.log("\nCreate Food Expense Category:");
  console.log(`curl -X POST http://localhost:8787/categories -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"name": "Makan", "type": "expense", "color": "#EF4444", "icon": "🍔"}'`);
  
  console.log("\nCreate Income Transaction (Rp 10,000,000):");
  console.log(`curl -X POST http://localhost:8787/transactions -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"category_id": "<ID_FROM_GAJI_RESPONSE>", "type": "income", "amount": 10000000, "date": ${Date.now()}, "note": "Gaji Bulan Ini", "items": [{"name": "Gaji", "quantity": 1, "price": 10000000}]}'`);
  
  console.log("\nCreate Expense Transaction (Rp 3,000,000):");
  console.log(`curl -X POST http://localhost:8787/transactions -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"category_id": "<ID_FROM_MAKAN_RESPONSE>", "type": "expense", "amount": 3000000, "date": ${Date.now()}, "note": "Makan siang sebulan", "items": [{"name": "Makan", "quantity": 30, "price": 100000}]}'`);

  console.log("\n--- FINALLY: Trigger AI Insight ---");
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  console.log(`curl -X GET "http://localhost:8787/insights/monthly?month=${month}&year=${year}&force_refresh=true" -H "Authorization: Bearer ${token}"\n`);
  
  console.log("This will generate a Cloudflare AI summary based on the 10M income and 3M expense.");
}

main();
