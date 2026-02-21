import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

describe("OAuth Endpoints (Mocked Redirects)", () => {
  const mockEnv = {
    DB: {} as any,
    SESSION_KV: {} as any,
    VERIFY_KV: {} as any,
    RESEND_API_KEY: "test",
    APP_URL: "http://localhost:8787",
    CORS_ORIGIN: "*",
    GOOGLE_CLIENT_ID: "g_id",
    GOOGLE_CLIENT_SECRET: "g_sec",
    GITHUB_CLIENT_ID: "gh_id",
    GITHUB_CLIENT_SECRET: "gh_sec"
  };

  test("GET /auth/google redirects to Google authorization URL", async () => {
    const req = new Request("http://localhost/auth/google");
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toInclude("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.get("location")).toInclude("client_id=g_id");
  });

  test("GET /auth/github redirects to GitHub authorization URL", async () => {
    const req = new Request("http://localhost/auth/github");
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toInclude("https://github.com/login/oauth/authorize");
    expect(res.headers.get("location")).toInclude("client_id=gh_id");
  });

  test("GET /auth/google/callback fails if no code provided", async () => {
    const req = new Request("http://localhost/auth/google/callback");
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe("BAD_REQUEST");
  });
});
