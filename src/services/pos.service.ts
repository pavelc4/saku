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

  async editPendingTransaction(
    userId: string,
    transactionId: string,
    editReason: string,
    items?: CheckoutItem[],
    paymentMethod?: string,
    note?: string | null
  ): Promise<void> {
    // Check if transaction exists, is pending, and belongs to user
    const transaction = await this.db.queryFirst<{
      id: string;
      status: string;
      source: string;
      pos_session_id: string;
    }>(`
      SELECT id, status, source, pos_session_id
      FROM transactions
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [transactionId, userId]);

    if (!transaction) {
      throw new Error("TRANSACTION_NOT_FOUND");
    }

    if (transaction.status !== 'pending') {
      throw new Error("CANNOT_EDIT_CONFIRMED");
    }

    if (transaction.source !== 'pos') {
      throw new Error("NOT_POS_TRANSACTION");
    }

    const now = Database.now();
    const queries: Array<{ sql: string; params: any[] }> = [];

    // If items are being updated, we need to:
    // 1. Return stock from old items
    // 2. Deduct stock for new items
    // 3. Delete old items
    // 4. Insert new items
    // 5. Recalculate amount
    if (items && items.length > 0) {
      // Get old items to return stock
      const oldItems = await this.db.query<{
        product_id: string;
        quantity: number;
      }>(`
        SELECT product_id, quantity
        FROM transaction_items
        WHERE transaction_id = ? AND product_id IS NOT NULL
      `, [transactionId]);

      // Return stock from old items
      for (const oldItem of oldItems) {
        queries.push({
          sql: `UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          params: [oldItem.quantity, now, oldItem.product_id, userId]
        });
      }

      // Validate new products and check stock
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

      if (products.length !== items.length) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const productMap = new Map(products.map(p => [p.id, p]));
      const insufficientStock: Array<{ product_id: string; name: string; available: number; requested: number }> = [];

      for (const item of items) {
        const product = productMap.get(item.product_id);
        if (!product) continue;

        if (product.is_active === 0) {
          throw new Error(`PRODUCT_INACTIVE: ${product.name}`);
        }

        // Check stock after returning old items
        const oldItemQty = oldItems.find(oi => oi.product_id === item.product_id)?.quantity || 0;
        const availableStock = product.stock + oldItemQty;

        if (availableStock < item.quantity) {
          insufficientStock.push({
            product_id: product.id,
            name: product.name,
            available: availableStock,
            requested: item.quantity
          });
        }
      }

      if (insufficientStock.length > 0) {
        const error: any = new Error("INSUFFICIENT_STOCK");
        error.details = insufficientStock;
        throw error;
      }

      // Calculate new amount
      let newAmount = 0;
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        newAmount += product.price * item.quantity;
      }

      // Delete old items
      queries.push({
        sql: `DELETE FROM transaction_items WHERE transaction_id = ?`,
        params: [transactionId]
      });

      // Insert new items
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        const itemId = Database.id();
        queries.push({
          sql: `INSERT INTO transaction_items (id, transaction_id, product_id, name, price, quantity, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [itemId, transactionId, item.product_id, product.name, product.price, item.quantity, now]
        });
      }

      // Deduct stock for new items
      for (const item of items) {
        queries.push({
          sql: `UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          params: [item.quantity, now, item.product_id, userId]
        });
      }

      // Update transaction amount
      queries.push({
        sql: `UPDATE transactions SET amount = ?, updated_at = ?, edit_reason = ? WHERE id = ?`,
        params: [newAmount, now, editReason, transactionId]
      });
    } else {
      // Only update payment method and/or note
      const updates: string[] = [];
      const values: any[] = [];

      if (paymentMethod !== undefined) {
        updates.push("payment_method = ?");
        values.push(paymentMethod);
      }

      if (note !== undefined) {
        updates.push("note = ?");
        values.push(note);
      }

      updates.push("edit_reason = ?", "updated_at = ?");
      values.push(editReason, now, transactionId);

      queries.push({
        sql: `UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`,
        params: values
      });
    }

    // Execute all queries atomically
    await this.db.batch(queries);
  }

  async cancelPendingTransaction(userId: string, transactionId: string): Promise<void> {
    // Check if transaction exists, is pending, and belongs to user
    const transaction = await this.db.queryFirst<{
      id: string;
      status: string;
      source: string;
    }>(`
      SELECT id, status, source
      FROM transactions
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `, [transactionId, userId]);

    if (!transaction) {
      throw new Error("TRANSACTION_NOT_FOUND");
    }

    if (transaction.status !== 'pending') {
      throw new Error("CANNOT_CANCEL_CONFIRMED");
    }

    if (transaction.source !== 'pos') {
      throw new Error("NOT_POS_TRANSACTION");
    }

    const now = Database.now();

    // Get items to return stock
    const items = await this.db.query<{
      product_id: string;
      quantity: number;
    }>(`
      SELECT product_id, quantity
      FROM transaction_items
      WHERE transaction_id = ? AND product_id IS NOT NULL
    `, [transactionId]);

    const queries: Array<{ sql: string; params: any[] }> = [];

    // Return stock for each item
    for (const item of items) {
      queries.push({
        sql: `UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        params: [item.quantity, now, item.product_id, userId]
      });
    }

    // Soft delete transaction
    queries.push({
      sql: `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      params: [now, now, transactionId]
    });

    // Execute all queries atomically
    await this.db.batch(queries);
  }

  async getSummaryToday(userId: string): Promise<{
    session_id: string | null;
    kasir_status: 'open' | 'closed';
    opened_at: number | null;
    total_transaksi: number;
    total_omzet: number;
    breakdown_payment: {
      cash: number;
      transfer: number;
      qris: number;
    };
    pending_count: number;
    confirmed_count: number;
  }> {
    // Get active session
    const activeSession = await this.getActiveSession(userId);

    // Get start of today (00:00:00)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000; // +24 hours

    // Get all POS transactions for today
    const summary = await this.db.queryFirst<{
      total_transaksi: number;
      total_omzet: number;
      pending_count: number;
      confirmed_count: number;
    }>(`
      SELECT 
        COUNT(*) as total_transaksi,
        COALESCE(SUM(amount), 0) as total_omzet,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count
      FROM transactions
      WHERE user_id = ?
        AND source = 'pos'
        AND date >= ?
        AND date < ?
        AND deleted_at IS NULL
    `, [userId, startOfToday, endOfToday]);

    // Get payment method breakdown
    const paymentBreakdown = await this.db.query<{
      payment_method: string;
      total: number;
    }>(`
      SELECT 
        payment_method,
        COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ?
        AND source = 'pos'
        AND date >= ?
        AND date < ?
        AND deleted_at IS NULL
      GROUP BY payment_method
    `, [userId, startOfToday, endOfToday]);

    const breakdown = {
      cash: 0,
      transfer: 0,
      qris: 0
    };

    for (const row of paymentBreakdown) {
      if (row.payment_method in breakdown) {
        breakdown[row.payment_method as keyof typeof breakdown] = row.total;
      }
    }

    return {
      session_id: activeSession?.id || null,
      kasir_status: activeSession ? 'open' : 'closed',
      opened_at: activeSession?.opened_at || null,
      total_transaksi: summary?.total_transaksi || 0,
      total_omzet: summary?.total_omzet || 0,
      breakdown_payment: breakdown,
      pending_count: summary?.pending_count || 0,
      confirmed_count: summary?.confirmed_count || 0
    };
  }
}


