import { Database } from "../lib/db";

export interface POSSession {
  id: string;
  user_id: string;
  opened_at: number;
  closed_at: number | null;
  total_omzet: number;
  created_at: number;
}

export interface CheckoutItem {
  product_id: string;
  quantity: number;
}

export interface CheckoutResult {
  transaction_id: string;
  amount: number;
  items: Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export class POSService {
  constructor(private db: Database) {}

  async getActiveSession(userId: string): Promise<POSSession | null> {
    const session = await this.db.queryFirst<POSSession>(`
      SELECT * FROM pos_sessions
      WHERE user_id = ? AND closed_at IS NULL
      ORDER BY opened_at DESC
      LIMIT 1
    `, [userId]);

    return session;
  }

  async openSession(userId: string): Promise<POSSession> {
    // Check if there's already an active session
    const activeSession = await this.getActiveSession(userId);
    if (activeSession) {
      throw new Error("ACTIVE_SESSION_EXISTS");
    }

    const id = Database.id();
    const now = Database.now();

    await this.db.execute(`
      INSERT INTO pos_sessions (id, user_id, opened_at, total_omzet, created_at)
      VALUES (?, ?, ?, 0, ?)
    `, [id, userId, now, now]);

    return {
      id,
      user_id: userId,
      opened_at: now,
      closed_at: null,
      total_omzet: 0,
      created_at: now
    };
  }

  async closeSession(userId: string): Promise<POSSession> {
    const activeSession = await this.getActiveSession(userId);
    if (!activeSession) {
      throw new Error("NO_ACTIVE_SESSION");
    }

    const now = Database.now();

    // Calculate total omzet from all transactions in this session
    const result = await this.db.queryFirst<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE pos_session_id = ? AND deleted_at IS NULL
    `, [activeSession.id]);

    const totalOmzet = result?.total || 0;

    // Use batch to atomically:
    // 1. Update pos_session (close it and set total_omzet)
    // 2. Bulk confirm all pending transactions in this session
    await this.db.batch([
      {
        sql: `UPDATE pos_sessions SET closed_at = ?, total_omzet = ? WHERE id = ?`,
        params: [now, totalOmzet, activeSession.id]
      },
      {
        sql: `UPDATE transactions SET status = 'confirmed', updated_at = ? WHERE pos_session_id = ? AND status = 'pending' AND deleted_at IS NULL`,
        params: [now, activeSession.id]
      }
    ]);

    return {
      ...activeSession,
      closed_at: now,
      total_omzet: totalOmzet
    };
  }

  async checkout(
    userId: string,
    items: CheckoutItem[],
    paymentMethod: string,
    categoryId: string | null,
    note: string | null
  ): Promise<CheckoutResult> {
    // Check if kasir is open
    const activeSession = await this.getActiveSession(userId);
    if (!activeSession) {
      throw new Error("KASIR_BELUM_DIBUKA");
    }

    // Validate all products and check stock
    const productIds = items.map(item => item.product_id);
    const products = await this.db.query<{
      id: string;
      name: string;
      price: number;
      stock: number;
      is_active: number;
    }>(`
      SELECT id, name, price, stock, is_active
      FROM products
      WHERE id IN (${productIds.map(() => '?').join(',')})
        AND user_id = ?
        AND deleted_at IS NULL
    `, [...productIds, userId]);

    // Check if all products exist
    if (products.length !== items.length) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    // Create product map for easy lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    // Validate stock and active status
    const insufficientStock: Array<{ product_id: string; name: string; available: number; requested: number }> = [];
    const inactiveProducts: string[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) continue;

      if (product.is_active === 0) {
        inactiveProducts.push(product.name);
      }

      if (product.stock < item.quantity) {
        insufficientStock.push({
          product_id: product.id,
          name: product.name,
          available: product.stock,
          requested: item.quantity
        });
      }
    }

    if (inactiveProducts.length > 0) {
      throw new Error(`PRODUCT_INACTIVE: ${inactiveProducts.join(', ')}`);
    }

    if (insufficientStock.length > 0) {
      const error: any = new Error("INSUFFICIENT_STOCK");
      error.details = insufficientStock;
      throw error;
    }

    // Calculate total amount
    let totalAmount = 0;
    const itemsWithDetails = items.map(item => {
      const product = productMap.get(item.product_id)!;
      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;
      return {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      };
    });

    // Prepare batch queries for atomic execution
    const transactionId = Database.id();
    const now = Database.now();
    const queries: Array<{ sql: string; params: any[] }> = [];

    // 1. Insert transaction
    queries.push({
      sql: `INSERT INTO transactions (id, user_id, category_id, type, amount, date, note, source, payment_method, status, pos_session_id, created_at, updated_at)
            VALUES (?, ?, ?, 'income', ?, ?, ?, 'pos', ?, 'pending', ?, ?, ?)`,
      params: [transactionId, userId, categoryId, totalAmount, now, note, paymentMethod, activeSession.id, now, now]
    });

    // 2. Insert transaction items
    for (const item of itemsWithDetails) {
      const itemId = Database.id();
      queries.push({
        sql: `INSERT INTO transaction_items (id, transaction_id, product_id, name, price, quantity, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [itemId, transactionId, item.product_id, item.name, item.price, item.quantity, now]
      });
    }

    // 3. Update stock for each product
    for (const item of items) {
      queries.push({
        sql: `UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        params: [item.quantity, now, item.product_id, userId]
      });
    }

    // Execute all queries atomically
    await this.db.batch(queries);

    return {
      transaction_id: transactionId,
      amount: totalAmount,
      items: itemsWithDetails
    };
  }
}

