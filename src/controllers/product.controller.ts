import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { ProductService } from "../services/product.service";
import { errorResponse, successResponse, paginatedResponse } from "../lib/response";

const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().int().positive().max(999_999_999),
  product_category_id: z.string().optional().nullable(),
  stock: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial();

const stockOverrideSchema = z.object({
  stock: z.number().int().min(0),
  reason: z.string().min(1).max(255),
});

export class ProductController {
  static async list(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "20", 10);

    try {
      const result = await service.listProducts(session.user_id, cursor, limit > 100 ? 100 : limit);
      return c.json(paginatedResponse(result.data, result.nextCursor, !!result.nextCursor));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to list products"), 500);
    }
  }

  static async getById(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const product = await service.getProductById(session.user_id, productId);
      if (!product) {
        return c.json(errorResponse("NOT_FOUND", "Product not found"), 404);
      }

      return c.json(successResponse(product));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to get product"), 500);
    }
  }

  static async create(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const body = await c.req.json();
      const parsed = createProductSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const product = await service.createProduct(session.user_id, parsed.data);
      return c.json(successResponse(product), 201);
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to create product"), 500);
    }
  }

  static async update(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const body = await c.req.json();
      const parsed = updateProductSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const success = await service.updateProduct(session.user_id, productId, parsed.data);
      if (!success) {
        return c.json(errorResponse("NOT_FOUND", "Product not found"), 404);
      }

      return c.json(successResponse({ message: "Product updated" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to update product"), 500);
    }
  }

  static async destroy(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const success = await service.deleteProduct(session.user_id, productId);
      if (!success) {
        return c.json(errorResponse("NOT_FOUND", "Product not found"), 404);
      }

      return c.json(successResponse({ message: "Product deleted" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to delete product"), 500);
    }
  }

  static async uploadPhoto(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const product = await service.getProductById(session.user_id, productId);
      if (!product) {
        return c.json(errorResponse("NOT_FOUND", "Product not found"), 404);
      }

      const body = await c.req.parseBody();
      const file = body["photo"];

      if (!file || !(file instanceof File)) {
        return c.json(errorResponse("BAD_REQUEST", "No photo file uploaded"), 400);
      }

      if (file.size > 5 * 1024 * 1024) {
        return c.json(errorResponse("BAD_REQUEST", "File size exceeds 5MB limit"), 400);
      }

      const allowedFormats = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedFormats.includes(file.type)) {
        return c.json(errorResponse("BAD_REQUEST", "Invalid file format. Only JPEG, PNG, and WebP are allowed"), 400);
      }

      const env = c.env as any;
      const ext = file.name.split('.').pop();
      const fileKey = `products/${session.user_id}/${productId}_${Database.id()}.${ext}`;

      await env.PRODUCTS_BUCKET.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      await service.updatePhotoUrl(session.user_id, productId, fileKey);

      return c.json(successResponse({ message: "Photo uploaded successfully", url: fileKey }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to upload photo"), 500);
    }
  }

  static async deletePhoto(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const product = await service.getProductById(session.user_id, productId);
      if (!product || !product.photo_url) {
        return c.json(errorResponse("NOT_FOUND", "Product or photo not found"), 404);
      }

      const env = c.env as any;
      await env.PRODUCTS_BUCKET.delete(product.photo_url);
      await service.deletePhotoUrl(session.user_id, productId);

      return c.json(successResponse({ message: "Photo deleted successfully" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to delete photo"), 500);
    }
  }

  static async overrideStock(c: Context) {
    const session = c.get("session");
    const productId = c.req.param("id");
    const db = new Database(c.env.DB);
    const service = new ProductService(db);

    try {
      const body = await c.req.json();
      const parsed = stockOverrideSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const success = await service.overrideStock(session.user_id, productId, parsed.data.stock);
      if (!success) {
        return c.json(errorResponse("NOT_FOUND", "Product not found"), 404);
      }

      return c.json(successResponse({ message: "Stock updated", reason: parsed.data.reason }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to override stock"), 500);
    }
  }
}
