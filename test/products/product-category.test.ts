import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const mockEnv = {
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT * FROM product_categories")) {
                return {
                  success: true,
                  results: [
                    { id: "sys1", user_id: null, name: "Makanan", color: "#F97316", created_at: 0, updated_at: 0, deleted_at: null },
                    { id: "custom1", user_id: "user_123", name: "Custom Cat", color: "#FF0000", created_at: 1, updated_at: 1, deleted_at: null }
                  ]
                };
              }
              return { success: true, results: [] };
            }),
            first: mock(async () => {
              if (query.includes("SELECT * FROM product_categories")) {
                // Check for WHERE id = ? AND user_id = ? (ownership check)
                if (params.length >= 2) {
                  const id = params[0];
                  const userId = params[1];
                  
                  // System default won't match user_id check
                  if (id === "sys1") {
                    return null;
                  }
                  // Custom category matches
                  if (id === "custom1" && userId === "user_123") {
                    return { id: "custom1", user_id: "user_123", name: "Custom Cat", color: "#FF0000" };
                  }
                }
                return null;
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

describe("Product Category Endpoints", () => {
  test("GET /products/categories returns system defaults + custom", async () => {
    const req = new Request("http://localhost/products/categories", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].user_id).toBe(null); // System default
  });

  test("POST /products/categories validates color format", async () => {
    const req = new Request("http://localhost/products/categories", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", color: "red" }) // Invalid hex
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });

  test("POST /products/categories succeeds with valid hex color", async () => {
    const req = new Request("http://localhost/products/categories", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Category", color: "#123456" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("PATCH /products/categories/:id fails for system default", async () => {
    const req = new Request("http://localhost/products/categories/sys1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(403);
  });

  test("PATCH /products/categories/:id succeeds for owned category", async () => {
    const req = new Request("http://localhost/products/categories/custom1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });

  test("DELETE /products/categories/:id fails for system default", async () => {
    const req = new Request("http://localhost/products/categories/sys1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(403);
  });

  test("DELETE /products/categories/:id succeeds for owned category", async () => {
    const req = new Request("http://localhost/products/categories/custom1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });
});
