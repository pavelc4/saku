import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { CategoryService, CreateCategoryDTO, UpdateCategoryDTO } from "../services/category.service";
import { errorResponse, successResponse } from "../lib/response";

// Schemas for input validation
const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["income", "expense", "both"]),
  color: z.string().regex(hexColorRegex, "Invalid hex color format"),
  // Allow max 4 characters for emojis (some combined emojis use multiple chars)
  icon: z.string().min(1).max(10, "Icon must be a short string/emoji"), 
});

const updateCategorySchema = createCategorySchema.partial();

export class CategoryController {
  
  static async list(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const categoryService = new CategoryService(db);

    try {
      const categories = await categoryService.listCategories(session.user_id);
      return c.json(successResponse(categories));
    } catch (err: any) {
      console.error("List categories error:", err);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to list categories"), 500);
    }
  }

  static async create(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const categoryService = new CategoryService(db);

    try {
      const body = await c.req.json();
      const parsed = createCategorySchema.safeParse(body);
      
      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400); // Ideally include format issues
      }

      const category = await categoryService.createCategory(session.user_id, parsed.data as CreateCategoryDTO);
      return c.json(successResponse(category), 201);
    } catch (err: any) {
      console.error("Create category error:", err);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to create category"), 500);
    }
  }

  static async update(c: Context) {
    const session = c.get("session");
    const categoryId = c.req.param("id");
    const db = new Database(c.env.DB);
    const categoryService = new CategoryService(db);

    try {
      const body = await c.req.json();
      const parsed = updateCategorySchema.safeParse(body);
      
      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      // Check if trying to update without any fields
      if (Object.keys(parsed.data).length === 0) {
        return c.json(errorResponse("BAD_REQUEST", "No fields to update"), 400);
      }

      const success = await categoryService.updateCategory(session.user_id, categoryId, parsed.data as UpdateCategoryDTO);
      
      if (!success) {
        return c.json(errorResponse("FORBIDDEN", "Category not found or you do not have permission to edit it"), 403);
      }

      return c.json(successResponse({ message: "Category updated successfully" }));
    } catch (err: any) {
      console.error("Update category error:", err);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to update category"), 500);
    }
  }

  static async destroy(c: Context) {
    const session = c.get("session");
    const categoryId = c.req.param("id");
    const db = new Database(c.env.DB);
    const categoryService = new CategoryService(db);

    try {
      const success = await categoryService.deleteCategory(session.user_id, categoryId);
      
      if (!success) {
        return c.json(errorResponse("FORBIDDEN", "Category not found or you do not have permission to delete it"), 403);
      }

      return c.json(successResponse({ message: "Category deleted successfully" }));
    } catch (err: any) {
      console.error("Delete category error:", err);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to delete category"), 500);
    }
  }
}
