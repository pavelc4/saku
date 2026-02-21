import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock Cloudflare Bindings for Rate Limit testing
let kvStore: Record<string, string> = {};

const mockKv = {
  get: mock(async (key: string) => {
    return kvStore[key] || null;
  }),
  put: mock(async (key: string, value: string, options?: any) => {
    kvStore[key] = value;
  }),
  delete: mock(async (key: string) => {
    delete kvStore[key];
  })
};

const mockEnv = {
  DB: {} as any, // Not used for this test directly but needed for env
  SESSION_KV: mockKv as any,
  VERIFY_KV: mockKv as any,
  RESEND_API_KEY: "test",
  APP_URL: "http://localhost:8787",
  CORS_ORIGIN: "*",
  GOOGLE_CLIENT_ID: "g_id",
  GOOGLE_CLIENT_SECRET: "g_sec",
  GITHUB_CLIENT_ID: "gh_id",
  GITHUB_CLIENT_SECRET: "gh_sec"
};

describe("Rate Limit Middleware", () => {
  test("POST /auth/register enforces 3 requests per minute", async () => {
    kvStore = {}; // Reset KV

    const makeReq = () => new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
      body: JSON.stringify({ email: "rl@test.com", password: "p", name: "n" }) // Will fail DB layer if it passes RL
    });

    // We only care about the Early return of 429
    // Call 1
    const res1 = await app.fetch(makeReq(), mockEnv as any);
    expect(res1.status).not.toBe(429);
    // Call 2
    const res2 = await app.fetch(makeReq(), mockEnv as any);
    expect(res2.status).not.toBe(429);
    // Call 3
    const res3 = await app.fetch(makeReq(), mockEnv as any);
    expect(res3.status).not.toBe(429);
    
    // Call 4 - Should be rate limited
    const res4 = await app.fetch(makeReq(), mockEnv as any);
    expect(res4.status).toBe(429);
    const body4 = await res4.json();
    expect(body4.error).toBe("TOO_MANY_REQUESTS");
  });

  test("POST /auth/login enforces 5 requests per minute", async () => {
    kvStore = {}; // Reset KV

    const makeReq = () => new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
      body: JSON.stringify({ email: "rl2@test.com", password: "p" })
    });

    // 5 allowed calls
    for(let i=0; i<5; i++) {
        const res = await app.fetch(makeReq(), mockEnv as any);
        expect(res.status).not.toBe(429);
    }
    
    // Call 6 - Should be rate limited
    const res6 = await app.fetch(makeReq(), mockEnv as any);
    expect(res6.status).toBe(429);
    const body6 = await res6.json();
    expect(body6.error).toBe("TOO_MANY_REQUESTS");
  });
});
