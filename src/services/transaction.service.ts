import { Database } from "../lib/db";

export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "ai_parsed";

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  price: number;
  created_at: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  date: number;
  note: string | null;
  source: TransactionSource;
  receipt_file_url: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  items?: TransactionItem[];
}

export interface CreateTransactionItemDTO {
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
}

export interface CreateTransactionDTO {
  category_id: string;
  type: TransactionType;
  amount: number;
  date: number;
  note?: string;
  source?: TransactionSource;
  items?: CreateTransactionItemDTO[];
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export class TransactionService {
  constructor(private db: Database) {}

  async listTransactions(userId: string, cursor?: string, limit: number = 20): Promise<PaginatedResult<Transaction>> {
    let sql = `
      SELECT t.*, 
             json_group_array(
               json_object(
                 'id', ti.id, 'product_id', ti.product_id, 'name', ti.name, 
                 'quantity', ti.quantity, 'price', ti.price
               )
             ) as items_json
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.user_id = ? AND t.deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (cursor) {
      sql += ` AND t.id < ?`;
      params.push(cursor);
    }

    // Group by transaction ID to aggregate items
    sql += ` GROUP BY t.id ORDER BY t.id DESC LIMIT ?`;
    params.push(limit + 1); // Fetch one extra to determine next_cursor

    const rows = await this.db.query<any>(sql, params);
    
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      nextCursor = rows[limit - 1].id;
      rows.pop(); // Remove the extra item
    }

    // Parse the JSON array string back to actual JS objects
    const data: Transaction[] = rows.map(row => {
      // Handle the case where there are no items (sqlite json_group_array returns '[{"id":null,...}]')
      let items = [];
      try {
        const parsedItems = JSON.parse(row.items_json);
        if (parsedItems.length > 0 && parsedItems[0].id !== null) {
          items = parsedItems;
        }
      } catch (e) {}
      
      delete row.items_json;
      return {
        ...row,
        items
      };
    });

    return {
      data,
      nextCursor
    };
  }

  async createTransaction(userId: string, data: CreateTransactionDTO): Promise<Transaction> {
    const id = Database.id();
    const now = Database.now();
    const source = data.source || "manual";

    const queries: { sql: string; params: any[] }[] = [];

    // Transaction insert
    queries.push({
      sql: `INSERT INTO transactions (id, user_id, category_id, type, amount, date, note, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [id, userId, data.category_id, data.type, data.amount, data.date, data.note || null, source, now, now]
    });

    const items: TransactionItem[] = [];

    // Items insert
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const itemId = Database.id();
        queries.push({
          sql: `INSERT INTO transaction_items (id, transaction_id, product_id, name, quantity, price, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [itemId, id, item.product_id || null, item.name, item.quantity, item.price, now]
        });
        items.push({
          id: itemId,
          transaction_id: id,
          product_id: item.product_id || null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          created_at: now
        });
      }
    }

    // Atomically execute all statements
    await this.db.batch(queries);

    return {
      id,
      user_id: userId,
      category_id: data.category_id,
      type: data.type,
      amount: data.amount,
      date: data.date,
      note: data.note || null,
      source,
      receipt_file_url: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      items
    };
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
    const now = Database.now();
    // Soft delete transaction
    const existing = await this.db.queryFirst(`SELECT id FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [transactionId, userId]);
    if (!existing) return false;

    await this.db.execute(`UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [now, now, transactionId, userId]);
    return true;
  }

  async getSummary(userId: string, periodStart: number, periodEnd: number) {
    const result = await this.db.queryFirst<{ total_income: number; total_expense: number; count: number }>(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        COUNT(id) as count
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL
    `, [userId, periodStart, periodEnd]);

    const totalIncome = result?.total_income || 0;
    const totalExpense = result?.total_expense || 0;

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net: totalIncome - totalExpense,
      transaction_count: result?.count || 0,
    };
  }

  // To update a transaction, typically the flow is complex (handling item updates, deletions etc).
  // For simplicity MVP we will allow updating top-level fields (amount, category_id, date, note)
  async updateTransactionBasic(userId: string, transactionId: string, data: Partial<CreateTransactionDTO>): Promise<boolean> {
    const existing = await this.db.queryFirst(`SELECT id FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [transactionId, userId]);
    if (!existing) return false;

    const updates: string[] = [];
    const values: any[] = [];
    const now = Database.now();

    if (data.category_id !== undefined) { updates.push("category_id = ?"); values.push(data.category_id); }
    if (data.type !== undefined) { updates.push("type = ?"); values.push(data.type); }
    if (data.amount !== undefined) { updates.push("amount = ?"); values.push(data.amount); }
    if (data.date !== undefined) { updates.push("date = ?"); values.push(data.date); }
    if (data.note !== undefined) { updates.push("note = ?"); values.push(data.note); }

    if (updates.length === 0) return true;

    updates.push("updated_at = ?");
    values.push(now);
    values.push(transactionId);
    values.push(userId);

    await this.db.execute(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`, values);
    return true;
  }

  async getTransactionById(userId: string, transactionId: string): Promise<Transaction | null> {
    const row = await this.db.queryFirst<Transaction>(
       `SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
       [transactionId, userId]
    );
    return row;
  }

  // Method to link receipt URL to transaction after R2 upload
  async updateReceiptUrl(userId: string, transactionId: string, url: string): Promise<boolean> {
    const now = Database.now();
    const existing = await this.db.queryFirst(`SELECT id FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [transactionId, userId]);
    if (!existing) return false;

    await this.db.execute(`UPDATE transactions SET receipt_file_url = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [url, now, transactionId, userId]);
    return true;
  }
}
