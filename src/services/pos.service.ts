import { Database } from "../lib/db";

export interface POSSession {
  id: string;
  user_id: string;
  opened_at: number;
  closed_at: number | null;
  total_omzet: number;
  created_at: number;
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
}
