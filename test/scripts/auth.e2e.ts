import { $ } from "bun";

async function run() {
  const APP_URL = "http://localhost:8787";
  const email = `test-auth-${Date.now()}@example.com`;
  const password = "password123";

  console.log("1. Registering user...");
  const regRes = await fetch(`${APP_URL}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Auth Test User" }),
    headers: { "Content-Type": "application/json" }
  });
  console.log(await regRes.json());

  console.log("2. Verifying email via local D1...");
  await $`npx wrangler d1 execute saku-db --local --command="UPDATE users SET email_verified = 1 WHERE email = '${email}'"`;

  console.log("3. Logging in...");
  const loginRes = await fetch(`${APP_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password, device: "e2e-test" }),
    headers: { "Content-Type": "application/json" }
  });
  const loginData: any = await loginRes.json();
  console.log(loginData);
  const token = loginData.data?.token;

  if (!token) {
    throw new Error("Login failed, no token received");
  }

  console.log("4. Fetching /auth/me...");
  const meRes = await fetch(`${APP_URL}/auth/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(await meRes.json());

  console.log("5. Logging out...");
  const logoutRes = await fetch(`${APP_URL}/auth/logout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(await logoutRes.json());

  console.log("6. Verifying /auth/me block after logout...");
  const meResAfter = await fetch(`${APP_URL}/auth/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(await meResAfter.json());
}

run().catch(console.error);
