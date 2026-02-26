import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const createMockEnv = (hasActiveSession: boolean = false) => ({
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              return { success: true, results: [] };
            }),
            first: mock(async () => {
              if (query.includes("SELECT * FROM pos_sessions WHERE user_id = ? AND closed_at IS NULL")) {
                if (hasActiveSession) {
                  return { 
                    id: "session1", 
                    user_id: "user_123", 
                    opened_at: Date.now() - 1000,
                    closed_at: null,
                    total_omzet: 0,
                    created_at: Date.now() - 1000
                  };
                }
                return null;
              }
              if (query.includes("SELECT COALESCE(SUM(amount), 0) as total")) {
                return { total: 500000 };
              }
              return null;
            }),
            run: mock(async () => {
              return { success: true };
            }),
          };
        })
      };
    }),
    batch: mock(async () => {
      return [{ success: true }, { success: true }];
    })
  } as any,
  SESSION_KV: {
    get: mock(async () => {
      return JSON.stringify({ user_id: "user_123", role: "user" });
    }),
  } as any,
  CORS_ORIGIN: "*",
});

describe("POS Session Endpoints", () => {
  test("GET /pos/session returns null when no active session", async () => {
    const req = new Request("http://localhost/pos/session", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(false) as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toBe(null);
  });

  test("GET /pos/session returns active session", async () => {
    const req = new Request("http://localhost/pos/session", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(true) as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).not.toBe(null);
    expect(body.data.id).toBe("session1");
  });

  test("POST /pos/open creates new session", async () => {
    const req = new Request("http://localhost/pos/open", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(false) as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("POST /pos/open fails when session already active (409)", async () => {
    const req = new Request("http://localhost/pos/open", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(true) as any);
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe("CONFLICT");
  });

  test("POST /pos/close fails when no active session (400)", async () => {
    const req = new Request("http://localhost/pos/close", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(false) as any);
    expect(res.status).toBe(400);
  });

  test("POST /pos/close succeeds and confirms all pending", async () => {
    const req = new Request("http://localhost/pos/close", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv(true) as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.closed_at).not.toBe(null);
  });
});
