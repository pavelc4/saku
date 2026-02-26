import { Database } from "../lib/db";

export interface ProductCategory {
  id: string;
  user_id: string | null;
  name: string;
  color: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface CreateProductCategoryDTO {
  name: string;
  color: string;
}

export class ProductCategoryService {
  constructor(private db: Database) {}

  async listCategories(userId: string): Promise<ProductCategory[]> {
    const categories = await this.db.query<ProductCategory>(`
      SELECT * FROM product_categories
      WHERE user_id = ?
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `, [userId]);

    return categories;
  }

  async createCategory(userId: string, data: CreateProductCategoryDTO): Promise<ProductCategory> {
    const id = Database.id();
    const now = Database.now();

    await this.db.execute(`
      INSERT INTO product_categories (id, user_id, name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, userId, data.name, data.color, now, now]);

    return {
      id,
      user_id: userId,
      name: data.name,
      color: data.color,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };
  }

  async updateCategory(userId: string, categoryId: string, data: Partial<CreateProductCategoryDTO>): Promise<boolean> {
    // Check if category exists and belongs to user (not system default)
    const existing = await this.db.queryFirst<ProductCategory>(`
      SELECT * FROM product_categories
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [categoryId, userId]);

    if (!existing) return false;

    const updates: string[] = [];
    const values: any[] = [];
    const now = Database.now();

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push("color = ?");
      values.push(data.color);
    }

    if (updates.length === 0) return true;

    updates.push("updated_at = ?");
    values.push(now);
    values.push(categoryId);
    values.push(userId);

    await this.db.execute(`
      UPDATE product_categories
      SET ${updates.join(", ")}
      WHERE id = ? AND user_id = ?
    `, values);

    return true;
  }

  async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    // Check if category exists and belongs to user (not system default)
    const existing = await this.db.queryFirst<ProductCategory>(`
      SELECT * FROM product_categories
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [categoryId, userId]);

    if (!existing) return false;

    const now = Database.now();
    await this.db.execute(`
      UPDATE product_categories
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [now, now, categoryId, userId]);

    return true;
  }
}
