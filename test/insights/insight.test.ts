import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock env
const mockDb = {
  execute: mock(async () => { return { success: true }; }),
  queryFirst: mock(async (query: string) => {
    if (query.includes("SELECT id, response")) {
      // Mock cache miss
      return null;
    }
    if (query.includes("SUM(CASE WHEN type = 'income'")) {
      return { income: 5000000, expense: 2000000 };
    }
    return null;
  }),
  query: mock(async (query: string) => {
     if (query.includes("SELECT c.name, SUM(t.amount)")) {
       return [{ name: "Food", total: 1000000 }];
     }
     return [];
  }),
  prepare: mock((query: string) => {
    return {
      bind: mock((...params: any[]) => {
        return {
          all: mock(async () => {
            if (query.includes("SUM(CASE WHEN type = 'income'")) {
              return { success: true, results: [{ income: 5000000, expense: 2000000 }] };
            }
            if (query.includes("SELECT id, response")) {
              return { success: true, results: [] };
            }
            if (query.includes("SELECT c.name, SUM(t.amount)")) {
               return { success: true, results: [{ name: "Food", total: 1000000 }] };
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
} as any;

const mockEnv = {
  DB: mockDb,
  SESSION_KV: {
    get: mock(async () => JSON.stringify({ user_id: "user_123", role: "user" })),
    put: mock(async () => {})
  } as any,
  CORS_ORIGIN: "*",
  AI: {
    run: mock(async () => {
      return { response: "According to the data, your finances are stable with a remaining balance of 3 Million." };
    })
  } as any
};

describe("Insight Endpoints", () => {
  test("GET /insights/monthly generates summary using AI", async () => {
    const req = new Request("http://localhost/insights/monthly?month=1&year=2024", {
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.insight).toContain("finances are stable");
  });

  test("GET /insights/monthly rejects invalid month", async () => {
    const req = new Request("http://localhost/insights/monthly?month=13&year=2024", {
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });
});
