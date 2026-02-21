import { Database } from "../lib/db";

export type CategoryType = "income" | "expense" | "both";

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface CreateCategoryDTO {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
}

export class CategoryService {
  constructor(private db: Database) {}

  async listCategories(userId: string): Promise<Category[]> {
    // Return both system (user_id IS NULL) and user-specific categories that are not deleted
    const res = await this.db.query<Category>(
      `SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND deleted_at IS NULL ORDER BY user_id DESC, created_at ASC`,
      [userId]
    );
    return res;
  }

  async createCategory(userId: string, data: CreateCategoryDTO): Promise<Category> {
    const id = Database.id();
    const now = Database.now();
    await this.db.execute(
      `INSERT INTO categories (id, user_id, name, type, color, icon, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, data.name, data.type, data.color, data.icon, now, now]
    );

    return {
      id,
      user_id: userId,
      name: data.name,
      type: data.type,
      color: data.color,
      icon: data.icon,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
  }

  async updateCategory(userId: string, categoryId: string, data: UpdateCategoryDTO): Promise<boolean> {
    const now = Database.now();
    
    // Safety check: ensure the category exists and belongs to the user (not a system category)
    const existing = await this.db.queryFirst<Category>(
      `SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [categoryId, userId]
    );

    if (!existing) return false;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push("type = ?");
      values.push(data.type);
    }
    if (data.color !== undefined) {
      updates.push("color = ?");
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      updates.push("icon = ?");
      values.push(data.icon);
    }

    if (updates.length === 0) return true; // Nothing to update

    updates.push("updated_at = ?");
    values.push(now);
    values.push(categoryId);
    values.push(userId);

    const query = `UPDATE categories SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`;
    await this.db.execute(query, values);
    return true;
  }

  async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    const now = Database.now();
    // Only update if it belongs to the user and is not already deleted
    
    // First verify it exists and is owned by user to distinguish between "not found" and "forbidden".
    const existing = await this.db.queryFirst<{ id: string }>(
      `SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [categoryId, userId]
    );

    if (!existing) return false;

    await this.db.execute(
      `UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [now, now, categoryId, userId]
    );
    return true;
  }
}
