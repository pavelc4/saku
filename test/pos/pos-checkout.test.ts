import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const createMockEnv = (scenario: string) => ({
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT id, name, price, stock, is_active") && query.includes("FROM products")) {
                if (scenario === "sufficient_stock") {
                  return {
                    success: true,
                    results: [
                      { id: "prod1", name: "Product 1", price: 10000, stock: 100, is_active: 1 },
                      { id: "prod2", name: "Product 2", price: 15000, stock: 50, is_active: 1 }
                    ]
                  };
                } else if (scenario === "insufficient_stock") {
                  return {
                    success: true,
                    results: [
                      { id: "prod1", name: "Product 1", price: 10000, stock: 5, is_active: 1 }
                    ]
                  };
                } else if (scenario === "inactive_product") {
                  return {
                    success: true,
                    results: [
                      { id: "prod1", name: "Product 1", price: 10000, stock: 100, is_active: 0 }
                    ]
                  };
                }
              }
              if (query.includes("SELECT * FROM pos_sessions") && query.includes("closed_at IS NULL")) {
                if (scenario === "no_session") {
                  return { success: true, results: [] };
                }
                return { 
                  success: true,
                  results: [{
                    id: "session1", 
                    user_id: "user_123", 
                    opened_at: Date.now(),
                    closed_at: null,
                    total_omzet: 0,
                    created_at: Date.now()
                  }]
                };
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
    }),
    batch: mock(async () => {
      return [{ success: true }, { success: true }, { success: true }];
    })
  } as any,
  SESSION_KV: {
    get: mock(async () => {
      return JSON.stringify({ user_id: "user_123", role: "user" });
    }),
  } as any,
  CORS_ORIGIN: "*",
});

describe("POS Checkout Endpoints", () => {
  test("POST /pos/checkout fails when kasir not open (400)", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ product_id: "prod1", quantity: 10 }],
        payment_method: "cash"
      })
    });
    const res = await app.fetch(req, createMockEnv("no_session") as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe("BAD_REQUEST");
  });

  test("POST /pos/checkout succeeds with sufficient stock", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { product_id: "prod1", quantity: 10 },
          { product_id: "prod2", quantity: 5 }
        ],
        payment_method: "cash",
        category_id: "cat1"
      })
    });
    const res = await app.fetch(req, createMockEnv("sufficient_stock") as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.transaction_id).toBeDefined();
    expect(body.data.amount).toBeGreaterThan(0);
  });

  test("POST /pos/checkout fails with insufficient stock (400)", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ product_id: "prod1", quantity: 100 }], // Request more than available
        payment_method: "cash"
      })
    });
    const res = await app.fetch(req, createMockEnv("insufficient_stock") as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe("INSUFFICIENT_STOCK");
    expect(body.details).toBeDefined();
  });

  test("POST /pos/checkout fails with inactive product (400)", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ product_id: "prod1", quantity: 10 }],
        payment_method: "cash"
      })
    });
    const res = await app.fetch(req, createMockEnv("inactive_product") as any);
    expect(res.status).toBe(400);
  });

  test("POST /pos/checkout validates items array is not empty", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [], // Empty items
        payment_method: "cash"
      })
    });
    const res = await app.fetch(req, createMockEnv("sufficient_stock") as any);
    expect(res.status).toBe(400);
  });

  test("POST /pos/checkout validates quantity is positive", async () => {
    const req = new Request("http://localhost/pos/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ product_id: "prod1", quantity: 0 }], // Zero quantity
        payment_method: "cash"
      })
    });
    const res = await app.fetch(req, createMockEnv("sufficient_stock") as any);
    expect(res.status).toBe(400);
  });
});
