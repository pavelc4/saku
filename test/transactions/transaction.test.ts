import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock environment bindings
const mockDb = {
  prepare: mock((query: string) => {
    return {
      bind: mock((...params: any[]) => {
        return {
          all: mock(async () => {
            if (query.includes("SELECT t.*, \n             json_group_array(")) {
              // list
              return { success: true, results: [{ id: "txn1", type: "expense", amount: 10000, items_json: "[{\"id\":\"itm1\",\"name\":\"snack\",\"price\":10000}]" }] };
            }
            if (query.includes("WHERE id = ? AND user_id = ? AND deleted_at IS NULL")) {
              if (params[0] === "txn1") {
                return { success: true, results: [{ id: "txn1", receipt_file_url: "receipts/user1/txn1.jpg" }] };
              }
              return { success: true, results: [] };
            }
            if (query.includes("total_income")) {
              return { success: true, results: [{ total_income: 50000, total_expense: 10000, count: 2 }] };
            }
            return { success: true, results: [] };
          }),
          run: mock(async () => {
            return { success: true };
          })
        }
      })
    }
  }),
  batch: mock(async (statements: any[]) => {
    return statements.map(() => ({ success: true }));
  })
} as any;

const mockEnv = {
  DB: mockDb,
  SESSION_KV: {
    get: mock(async () => JSON.stringify({ user_id: "user_123", role: "user" })),
    put: mock(async () => {})
  } as any,
  CORS_ORIGIN: "*",
  RECEIPTS_BUCKET: {
    put: mock(async () => {}),
    get: mock(async (key: string) => {
      if (key === "receipts/user1/txn1.jpg") {
        return {
          body: new Blob(["fake-image-data"]),
          httpEtag: "etag123",
          writeHttpMetadata: (headers: any) => headers.set("content-type", "image/jpeg")
        };
      }
      return null;
    })
  } as any
};

describe("Transaction Endpoints", () => {
  test("POST /transactions creates a manual transaction", async () => {
    const req = new Request("http://localhost/transactions", {
      method: "POST",
      headers: { "Authorization": "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: "cat1",
        type: "expense",
        amount: 25000,
        date: Date.now(),
        items: [{ name: "Lunch", quantity: 1, price: 25000 }]
      })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(25000);
    expect(body.data.items.length).toBe(1);
  });

  test("GET /transactions lists paginated transactions", async () => {
    const req = new Request("http://localhost/transactions", {
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toBe("txn1");
  });

  test("GET /transactions/summary returns aggregations", async () => {
    const req = new Request("http://localhost/transactions/summary?period=month", {
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.total_income).toBe(50000);
    expect(body.data.net).toBe(40000);
  });

  test("DELETE /transactions/:id performs soft delete", async () => {
    const req = new Request("http://localhost/transactions/txn1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });

  test("GET /transactions/:id/receipt serves R2 file", async () => {
    const req = new Request("http://localhost/transactions/txn1/receipt", {
      headers: { "Authorization": "Bearer token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("etag")).toBe("etag123");
  });

  test("POST /transactions/:id/receipt handles multiform form-data upload", async () => {
    const formData = new FormData();
    formData.append("receipt", new Blob(["fake-image"], { type: "image/jpeg" }), "receipt.jpg");

    const req = new Request("http://localhost/transactions/txn1/receipt", {
      method: "POST",
      headers: { "Authorization": "Bearer token" },
      body: formData
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.url).toInclude("receipts/");
  });
});
