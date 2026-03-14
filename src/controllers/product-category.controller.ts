import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { ProductCategoryService } from "../services/product-category.service";
import { errorResponse, successResponse } from "../lib/response";

const createProductCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format warna tidak valid"),
});

const updateProductCategorySchema = createProductCategorySchema.partial();

export class ProductCategoryController {
  static async list(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const service = new ProductCategoryService(db);

    try {
      const categories = await service.listCategories(session.user_id);
      return c.json(successResponse(categories));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to list product categories"), 500);
    }
  }

  static async create(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const service = new ProductCategoryService(db);

    try {
      const body = await c.req.json();
      const parsed = createProductCategorySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const category = await service.createCategory(session.user_id, parsed.data);
      return c.json(successResponse(category), 201);
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to create product category"), 500);
    }
  }

  static async update(c: Context) {
    const session = c.get("session");
    const categoryId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductCategoryService(db);

    try {
      const body = await c.req.json();
      const parsed = updateProductCategorySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const success = await service.updateCategory(session.user_id, categoryId, parsed.data);
      if (!success) {
        return c.json(errorResponse("FORBIDDEN", "Cannot edit system default or category not found"), 403);
      }

      return c.json(successResponse({ message: "Product category updated" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to update product category"), 500);
    }
  }

  static async destroy(c: Context) {
    const session = c.get("session");
    const categoryId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductCategoryService(db);

    try {
      const success = await service.deleteCategory(session.user_id, categoryId);
      if (!success) {
        return c.json(errorResponse("FORBIDDEN", "Cannot delete system default or category not found"), 403);
      }

      return c.json(successResponse({ message: "Product category deleted" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to delete product category"), 500);
    }
  }
}
