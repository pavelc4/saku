import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const mockEnv = {
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("GROUP BY payment_method")) {
                return {
                  success: true,
                  results: [
                    { payment_method: "cash", total: 300000 },
                    { payment_method: "transfer", total: 150000 },
                    { payment_method: "qris", total: 50000 }
                  ]
                };
              }
              return { success: true, results: [] };
            }),
            first: mock(async () => {
              if (query.includes("SELECT * FROM pos_sessions WHERE user_id = ? AND closed_at IS NULL")) {
                return { 
                  id: "session1", 
                  user_id: "user_123", 
                  opened_at: Date.now() - 3600000,
                  closed_at: null,
                  total_omzet: 0,
                  created_at: Date.now() - 3600000
                };
              }
              if (query.includes("COUNT(*) as total_transaksi")) {
                return {
                  total_transaksi: 25,
                  total_omzet: 500000,
                  pending_count: 5,
                  confirmed_count: 20
                };
              }
              return null;
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
    get: mock(async () => {
      return JSON.stringify({ user_id: "user_123", role: "user" });
    }),
  } as any,
  CORS_ORIGIN: "*",
};

describe("POS Summary Today", () => {
  test("GET /pos/summary-today returns comprehensive summary", async () => {
    const req = new Request("http://localhost/pos/summary-today", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.session_id).toBeDefined();
    expect(body.data.kasir_status).toBeDefined();
    expect(body.data.total_transaksi).toBeDefined();
    expect(body.data.total_omzet).toBeDefined();
    expect(body.data.breakdown_payment).toBeDefined();
    expect(body.data.pending_count).toBeDefined();
    expect(body.data.confirmed_count).toBeDefined();
  });

  test("GET /pos/summary-today includes payment breakdown", async () => {
    const req = new Request("http://localhost/pos/summary-today", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    const body = await res.json() as any;
    expect(body.data.breakdown_payment.cash).toBeDefined();
    expect(body.data.breakdown_payment.transfer).toBeDefined();
    expect(body.data.breakdown_payment.qris).toBeDefined();
  });

  test("GET /pos/summary-today shows kasir status", async () => {
    const req = new Request("http://localhost/pos/summary-today", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    const body = await res.json() as any;
    expect(["open", "closed"]).toContain(body.data.kasir_status);
  });
});
