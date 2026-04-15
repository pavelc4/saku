import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const createMockEnv = (scenario: string) => ({
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT product_id, quantity") && query.includes("FROM transaction_items")) {
                return {
                  success: true,
                  results: [
                    { product_id: "prod1", quantity: 10 },
                    { product_id: "prod2", quantity: 5 }
                  ]
                };
              }
              if (query.includes("SELECT id, name, price, stock, is_active") && query.includes("FROM products")) {
                return {
                  success: true,
                  results: [
                    { id: "prod1", name: "Product 1", price: 10000, stock: 100, is_active: 1 },
                    { id: "prod2", name: "Product 2", price: 15000, stock: 50, is_active: 1 }
                  ]
                };
              }
              if (query.includes("SELECT id, status, source") && query.includes("FROM transactions")) {
                if (scenario === "pending_pos") {
                  return { success: true, results: [{ id: "txn1", status: "pending", source: "pos", pos_session_id: "session1" }] };
                } else if (scenario === "confirmed") {
                  return { success: true, results: [{ id: "txn1", status: "confirmed", source: "pos" }] };
                } else if (scenario === "not_pos") {
                  return { success: true, results: [{ id: "txn1", status: "pending", source: "manual" }] };
                } else if (scenario === "not_found") {
                  return { success: true, results: [] };
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

describe("POS Edit Transaction", () => {
  test("PATCH /pos/transactions/:id requires edit_reason", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: "transfer"
        // Missing edit_reason
      })
    });
    const res = await app.fetch(req, createMockEnv("pending_pos") as any);
    expect(res.status).toBe(400);
  });

  test("PATCH /pos/transactions/:id succeeds with edit_reason", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        edit_reason: "Customer changed payment method",
        payment_method: "transfer"
      })
    });
    const res = await app.fetch(req, createMockEnv("pending_pos") as any);
    expect(res.status).toBe(200);
  });

  test("PATCH /pos/transactions/:id fails if status is confirmed", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        edit_reason: "Test",
        payment_method: "transfer"
      })
    });
    const res = await app.fetch(req, createMockEnv("confirmed") as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.message).toContain("confirmed");
  });

  test("PATCH /pos/transactions/:id fails if not POS transaction", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        edit_reason: "Test",
        payment_method: "transfer"
      })
    });
    const res = await app.fetch(req, createMockEnv("not_pos") as any);
    expect(res.status).toBe(400);
  });

  test("PATCH /pos/transactions/:id fails if transaction not found", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({
        edit_reason: "Test",
        payment_method: "transfer"
      })
    });
    const res = await app.fetch(req, createMockEnv("not_found") as any);
    expect(res.status).toBe(404);
  });
});

describe("POS Cancel Transaction", () => {
  test("DELETE /pos/transactions/:id succeeds for pending POS transaction", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv("pending_pos") as any);
    expect(res.status).toBe(200);
  });

  test("DELETE /pos/transactions/:id fails if status is confirmed", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv("confirmed") as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.message).toContain("confirmed");
  });

  test("DELETE /pos/transactions/:id fails if not POS transaction", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv("not_pos") as any);
    expect(res.status).toBe(400);
  });

  test("DELETE /pos/transactions/:id fails if transaction not found", async () => {
    const req = new Request("http://localhost/pos/transactions/txn1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, createMockEnv("not_found") as any);
    expect(res.status).toBe(404);
  });
});
