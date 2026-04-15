import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock Cloudflare Bindings
const mockDb = {
  prepare: mock((query: string) => {
    return {
      bind: mock((...params: any[]) => {
        return {
          all: mock(async () => {
            // Basic mock for users select
            if (query.includes("WHERE email = ?")) {
              if (params[0] === "test@example.com") {
                return { success: true, results: [{ id: "user_123", email: "test@example.com", password_hash: "$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", role: "user", is_banned: 0, email_verified: 1 }] };
              }
              return { success: true, results: [] };
            }
            return { success: true, results: [] };
          }),
          run: mock(async () => {
            return { success: true };
          })
        };
      })
    };
  })
};

const mockKv = {
  get: mock(async (key: string) => {
    if (key.startsWith("verify:")) return "user_123";
    if (key.startsWith("session:valid_token")) return JSON.stringify({ user_id: "user_123", role: "user", email: "test@example.com", created_at: Date.now(), expires_at: Date.now() + 86400000 });
    return null;
  }),
  put: mock(async (key: string, value: string, options?: any) => { }),
  delete: mock(async (key: string) => { })
};

const mockEnv = {
  DB: mockDb as any,
  SESSION_KV: mockKv as any,
  VERIFY_KV: mockKv as any,
  RESEND_API_KEY: "re_test_key",
  APP_URL: "http://localhost:8787",
  FRONTEND_URL: "http://localhost:5173",
  CORS_ORIGIN: "*"
};

describe("Auth Endpoints", () => {
  test("POST /auth/register fails if user exists", async () => {
    const req = new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password123", name: "Test User" })
    });

    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  test("POST /auth/register succeeds for new user", async () => {
    const req = new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", password: "password123", name: "New User" })
    });

    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("GET /auth/verify succeeds with valid token", async () => {
    const req = new Request("http://localhost/auth/verify?token=valid_token");
    const res = await app.fetch(req, mockEnv as any);

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("status=success");
  });

  test("POST /auth/login fails with bad password", async () => { // Mock always fails compare for this simple test unless we stub verifyPassword
    // Since we hash pass randomly, let's just assert 401 for generic mock
    const req = new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "wrongpassword" })
    });

    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(401);
  });

  test("GET /auth/me fails without token", async () => {
    const req = new Request("http://localhost/auth/me");
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(401);
  });

  test("GET /auth/me succeeds with valid token", async () => {
    const req = new Request("http://localhost/auth/me", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("test@example.com");
  });
});
