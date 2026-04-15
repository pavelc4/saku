import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

const mockEnv = {
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT p.*, pc.name as category_name")) {
                if (params.length >= 2 && params[0] === "prod1" && params[1] === "user_123") {
                  return { 
                    success: true,
                    results: [{
                      id: "prod1", 
                      user_id: "user_123", 
                      name: "Product 1", 
                      price: 10000,
                      stock: 50,
                      is_active: 1,
                      photo_url: null,
                      product_category_id: "cat1",
                      category_name: "Makanan",
                      category_color: "#F97316",
                      created_at: 1,
                      updated_at: 1,
                      deleted_at: null
                    }]
                  };
                }
                return {
                  success: true,
                  results: [
                    { 
                      id: "prod1", 
                      user_id: "user_123", 
                      name: "Product 1", 
                      price: 10000, 
                      stock: 50,
                      is_active: 1,
                      photo_url: null,
                      product_category_id: "cat1",
                      category_name: "Makanan",
                      category_color: "#F97316",
                      created_at: 1,
                      updated_at: 1,
                      deleted_at: null
                    }
                  ]
                };
              }
              // For ownership check in update/delete (with or without deleted_at IS NULL)
              if (query.includes("SELECT id FROM products WHERE id = ?") && query.includes("user_id = ?")) {
                if (params.length >= 2 && params[0] === "prod1" && params[1] === "user_123") {
                  return { success: true, results: [{ id: "prod1" }] };
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
  PRODUCTS_BUCKET: {
    put: mock(async () => {}),
    delete: mock(async () => {}),
  } as any,
  CORS_ORIGIN: "*",
};

describe("Product Endpoints", () => {
  test("GET /products returns paginated products", async () => {
    const req = new Request("http://localhost/products", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /products/:id returns product detail", async () => {
    const req = new Request("http://localhost/products/prod1", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("prod1");
  });

  test("POST /products validates price is positive", async () => {
    const req = new Request("http://localhost/products", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", price: 0, stock: 10 }) // Price must be positive
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });

  test("POST /products validates stock is non-negative", async () => {
    const req = new Request("http://localhost/products", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", price: 10000, stock: -5 }) // Stock cannot be negative
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });

  test("POST /products succeeds with valid data", async () => {
    const req = new Request("http://localhost/products", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Product", price: 15000, stock: 100 })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("PATCH /products/:id updates product", async () => {
    const req = new Request("http://localhost/products/prod1", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Product", price: 20000 })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });

  test("DELETE /products/:id soft deletes product", async () => {
    const req = new Request("http://localhost/products/prod1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });

  test("PATCH /products/:id/stock validates stock is non-negative", async () => {
    const req = new Request("http://localhost/products/prod1/stock", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ stock: -10, reason: "Test" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });

  test("PATCH /products/:id/stock requires reason", async () => {
    const req = new Request("http://localhost/products/prod1/stock", {
      method: "PATCH",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ stock: 100 }) // Missing reason
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });
});
