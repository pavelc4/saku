const API_URL = "http://localhost:8787";

async function run() {
  const token = process.argv[2];
  
  if (!token) {
    console.log("ERROR: Missing token!");
    console.log("Usage: bun run test-ai-e2e.ts <YOUR_TOKEN_HERE>");
    console.log("\n1. Login via browser: http://localhost:8787/auth/google");
    console.log("2. Copy the token from the URL (`?token=ey...`)");
    console.log("3. Run this script again with the token pasted at the end.\n");
    return;
  }

  console.log("Starting Automated AI Insight Test with provided token...");

  console.log("\n1. Creating Income and Expense Categories...");
  
  const catIncomeRes = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Gaji Perusahaan", type: "income", color: "#10B981", icon: "💰" })
  }).then(res => res.json());

  const catExpenseRes = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Biaya Server", type: "expense", color: "#EF4444", icon: "💻" })
  }).then(res => res.json());

  if (!catIncomeRes.success || !catExpenseRes.success) {
      console.log("Failed to create categories. Token might be invalid or expired.");
      console.log(catIncomeRes, catExpenseRes);
      return;
  }

  const incomeCatId = catIncomeRes.data.id;
  const expenseCatId = catExpenseRes.data.id;
  console.log(`Categories created. (Income ID: ${incomeCatId}, Expense ID: ${expenseCatId})`);

  console.log("\n2. Injecting Transactions (Income: 15M, Expense: 2M)...");
  
  await fetch(`${API_URL}/transactions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: incomeCatId,
      type: "income",
      amount: 15000000,
      date: Date.now(),
      note: "Gaji Project Auriya",
      items: [{ name: "Gaji", quantity: 1, price: 15000000 }]
    })
  });

  await fetch(`${API_URL}/transactions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: expenseCatId,
      type: "expense",
      amount: 2000000,
      date: Date.now(),
      note: "Bayar VPS Cloudflare & AWS",
      items: [{ name: "VPS", quantity: 1, price: 2000000 }]
    })
  });
  console.log("Transactions injected successfully.");

  console.log("\n3. Triggering AI Insights Generator...");
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  const aiRes = await fetch(`${API_URL}/insights/monthly?month=${month}&year=${year}&force_refresh=true`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  const aiData = await aiRes.json();
  
  console.log("\n=======================================================");
  console.log("AI INSIGHT RESULT:");
  console.log("=======================================================");
  if (aiData.success) {
     console.log(aiData.data.insight);
  } else {
     console.log("Error:", aiData);
  }
  console.log("=======================================================\n");
}

run().catch(console.error);
