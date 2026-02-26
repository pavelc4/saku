import { Database } from "../lib/db";

export interface Product {
  id: string;
  user_id: string;
  product_category_id: string | null;
  name: string;
  price: number;
  photo_url: string | null;
  stock: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  category_name?: string | null;
  category_color?: string | null;
}

export interface CreateProductDTO {
  name: string;
  price: number;
  product_category_id?: string | null;
  stock?: number;
  is_active?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export class ProductService {
  constructor(private db: Database) {}

  async listProducts(userId: string, cursor?: string, limit: number = 20): Promise<PaginatedResult<Product>> {
    let sql = `
      SELECT p.*, pc.name as category_name, pc.color as category_color
      FROM products p
      LEFT JOIN product_categories pc ON p.product_category_id = pc.id
      WHERE p.user_id = ? AND p.deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (cursor) {
      sql += ` AND p.id > ?`;
      params.push(cursor);
    }

    sql += ` ORDER BY p.id ASC LIMIT ?`;
    params.push(limit + 1);

    const rows = await this.db.query<Product>(sql, params);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      nextCursor = rows[limit - 1].id;
      rows.pop();
    }

    return {
      data: rows,
      nextCursor
    };
  }

  async getProductById(userId: string, productId: string): Promise<Product | null> {
    const product = await this.db.queryFirst<Product>(`
      SELECT p.*, pc.name as category_name, pc.color as category_color
      FROM products p
      LEFT JOIN product_categories pc ON p.product_category_id = pc.id
      WHERE p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL
    `, [productId, userId]);

    return product;
  }

  async createProduct(userId: string, data: CreateProductDTO): Promise<Product> {
    const id = Database.id();
    const now = Database.now();
    const stock = data.stock ?? 0;
    const isActive = data.is_active ?? true;

    await this.db.execute(`
      INSERT INTO products (id, user_id, product_category_id, name, price, stock, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, data.product_category_id || null, data.name, data.price, stock, isActive ? 1 : 0, now, now]);

    return {
      id,
      user_id: userId,
      product_category_id: data.product_category_id || null,
      name: data.name,
      price: data.price,
      photo_url: null,
      stock,
      is_active: isActive ? 1 : 0,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };
  }

  async updateProduct(userId: string, productId: string, data: Partial<CreateProductDTO>): Promise<boolean> {
    const existing = await this.db.queryFirst(`
      SELECT id FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [productId, userId]);

    if (!existing) return false;

    const updates: string[] = [];
    const values: any[] = [];
    const now = Database.now();

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    if (data.price !== undefined) {
      updates.push("price = ?");
      values.push(data.price);
    }
    if (data.product_category_id !== undefined) {
      updates.push("product_category_id = ?");
      values.push(data.product_category_id);
    }
    if (data.stock !== undefined) {
      updates.push("stock = ?");
      values.push(data.stock);
    }
    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(data.is_active ? 1 : 0);
    }

    if (updates.length === 0) return true;

    updates.push("updated_at = ?");
    values.push(now);
    values.push(productId);
    values.push(userId);

    await this.db.execute(`
      UPDATE products SET ${updates.join(", ")}
      WHERE id = ? AND user_id = ?
    `, values);

    return true;
  }

  async deleteProduct(userId: string, productId: string): Promise<boolean> {
    const existing = await this.db.queryFirst(`
      SELECT id FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [productId, userId]);

    if (!existing) return false;

    const now = Database.now();
    await this.db.execute(`
      UPDATE products SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [now, now, productId, userId]);

    return true;
  }

  async updatePhotoUrl(userId: string, productId: string, photoUrl: string): Promise<boolean> {
    const existing = await this.db.queryFirst(`
      SELECT id FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [productId, userId]);

    if (!existing) return false;

    const now = Database.now();
    await this.db.execute(`
      UPDATE products SET photo_url = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [photoUrl, now, productId, userId]);

    return true;
  }

  async deletePhotoUrl(userId: string, productId: string): Promise<boolean> {
    const existing = await this.db.queryFirst(`
      SELECT id FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [productId, userId]);

    if (!existing) return false;

    const now = Database.now();
    await this.db.execute(`
      UPDATE products SET photo_url = NULL, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [now, productId, userId]);

    return true;
  }

  async overrideStock(userId: string, productId: string, stock: number): Promise<boolean> {
    const existing = await this.db.queryFirst(`
      SELECT id FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [productId, userId]);

    if (!existing) return false;

    const now = Database.now();
    await this.db.execute(`
      UPDATE products SET stock = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [stock, now, productId, userId]);

    return true;
  }
}
