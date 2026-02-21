import { describe, expect, test, mock } from "bun:test";
import app from "../../src/index";

// Mock env
const mockEnv = {
  DB: {
    prepare: mock((query: string) => {
      return {
        bind: mock((...params: any[]) => {
          return {
            all: mock(async () => {
              if (query.includes("SELECT * FROM categories")) {
                // Mock list: 1 system, 1 user custom
                return {
                  success: true,
                  results: [
                    { id: "sys1", user_id: null, name: "Food", type: "expense", color: "#FF0000", icon: "🍔", created_at: 1, updated_at: 1, deleted_at: null },
                    { id: "cust1", user_id: "user_123", name: "Games", type: "expense", color: "#00FF00", icon: "🎮", created_at: 2, updated_at: 2, deleted_at: null }
                  ]
                };
              }
              if (query.includes("SELECT id FROM categories WHERE id = ? AND user_id = ?")) {
                // Mock checking ownership
                if (params[0] === "cust1" && params[1] === "user_123") {
                  return { success: true, results: [{ id: "cust1" }] };
                }
                return { success: true, results: [] };
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
    get: mock(async () => {
      return JSON.stringify({ user_id: "user_123", role: "user" }); // Always return valid session
    }),
    put: mock(async () => {}),
  } as any,
  CORS_ORIGIN: "*",
};

describe("Category Endpoints", () => {
  test("GET /categories lists merged categories", async () => {
    const req = new Request("http://localhost/categories", {
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].id).toBe("sys1");
  });

  test("POST /categories validates Zod schema (bad color)", async () => {
    const req = new Request("http://localhost/categories", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", type: "expense", color: "red", icon: "A" }) // Bad hex
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(400);
  });

  test("POST /categories succeeds with valid data", async () => {
    const req = new Request("http://localhost/categories", {
      method: "POST",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", type: "income", color: "#112233", icon: "💸" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  test("PUT /categories/:id fails for system categories (ownership check)", async () => {
    const req = new Request("http://localhost/categories/sys1", {
      method: "PUT",
      headers: { "Authorization": "Bearer valid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" })
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(403);
  });

  test("DELETE /categories/:id succeeds for owned category", async () => {
    const req = new Request("http://localhost/categories/cust1", {
      method: "DELETE",
      headers: { "Authorization": "Bearer valid_token" }
    });
    const res = await app.fetch(req, mockEnv as any);
    expect(res.status).toBe(200);
  });
});
