import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock env
const mockEnv = {
  DB: {
    execute: mock(async () => { return { success: true }; }),
    queryFirst: mock(async (query: string) => {
      if (query.includes("SELECT id FROM users")) {
        return { success: true, results: [{ id: "user_123" }] };
      }
      return { success: true, results: [] };
    }),
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT id FROM users")) {
                return { success: true, results: [{ id: "user_123" }] };
              }
              return { success: true, results: [] };
            }),
            run: mock(async () => {
              return { success: true };
            }),
          };
        })
      };
    })
  } as any,
  SESSION_KV: {
    get: mock(async () => JSON.stringify({ user_id: "user_123", role: "user" })),
    put: mock(async () => {})
  } as any,
  CORS_ORIGIN: "*"
};

describe("User Endpoints", () => {
  test("PUT /users/me updates profile name", async () => {
    const req = new Request("http://localhost/users/me", {
      method: "PUT",
      headers: { "Authorization": "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("PUT /users/me rejects empty payload", async () => {
    const req = new Request("http://localhost/users/me", {
      method: "PUT",
      headers: { "Authorization": "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });
});
