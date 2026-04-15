import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const mockEnv = {
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SUM(CASE WHEN type = 'income'")) {
                // Verify that query includes status = 'confirmed' filter
                if (query.includes("status = 'confirmed'")) {
                  return {
                    success: true,
                    results: [{
                      total_income: 1000000,
                      total_expense: 500000,
                      count: 10
                    }]
                  };
                } else {
                  // If status filter is missing, return different values to detect the issue
                  return {
                    success: true,
                    results: [{
                      total_income: 1500000, // Would include pending
                      total_expense: 700000,
                      count: 15
                    }]
                  };
                }
              }
              return { success: true, results: [] };
            }),
            first: mock(async () => null),
            run: mock(async () => {
              return { success: true };
            }),
          };
        })
      };
    })
  } as any,
  SESSION_KV: {
    get: mock(async () => {
      return JSON.stringify({ user_id: "user_123", role: "user" });
    }),
  } as any,
  CORS_ORIGIN: "*",
};

describe("Transaction Summary - Confirmed Only", () => {
  test("GET /transactions/summary only counts confirmed transactions", async () => {
    const req = new Request("http://localhost/transactions/summary?period=month", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.total_income).toBe(1000000);
    expect(body.data.total_expense).toBe(500000);
    expect(body.data.transaction_count).toBe(10);
  });

  test("GET /transactions/summary excludes pending transactions", async () => {
    const req = new Request("http://localhost/transactions/summary?period=today", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    const body = await res.json() as any;
    
    // Should only count confirmed (10 transactions, not 15)
    expect(body.data.transaction_count).toBe(10);
    expect(body.data.total_income).toBe(1000000);
  });

  test("GET /transactions/summary calculates net correctly", async () => {
    const req = new Request("http://localhost/transactions/summary?period=week", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    const body = await res.json() as any;
    
    expect(body.data.net).toBe(500000); // 1000000 - 500000
  });

  test("GET /transactions/summary works for different periods", async () => {
    const periods = ["today", "week", "month", "year"];
    
    for (const period of periods) {
      const req = new Request(`http://localhost/transactions/summary?period=${period}`, {
        headers: { "Authorization": "Bearer valid_token" }
      });
      const res = await app.fetch(req, mockEnv as any);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    }
  });
});
