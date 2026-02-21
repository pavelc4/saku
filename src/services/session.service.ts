import { KVNamespace } from "@cloudflare/workers-types";
import { Database } from "../lib/db";
import { generateOpaqueToken } from "../lib/crypto";

export type SessionData = {
  user_id: string;
  role: string;
  email: string;
  device?: string;
  ip?: string;
  created_at: number;
  expires_at: number;
};

const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const SESSION_TTL_SEC = SESSION_TTL_DAYS * 24 * 60 * 60;

export class SessionService {
  constructor(private kv: KVNamespace, private db: Database) {}

  async createSession(
    userId: string,
    email: string,
    role: string,
    device?: string,
    ip?: string
  ): Promise<string> {
    const sessionId = generateOpaqueToken();
    const createdAt = Database.now();
    const expiresAt = createdAt + SESSION_TTL_MS;

    const sessionData: SessionData = {
      user_id: userId,
      role,
      email,
      device,
      ip,
      created_at: createdAt,
      expires_at: expiresAt,
    };

    // 1. Store in KV (Hot path for auth)
    await this.kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL_SEC,
    });

    // 2. Also keep user's active session IDs in a list for revocation mapping
    const userSessionsKey = `user_sessions:${userId}`;
    let activeSessions: string[] = [];
    const existing = await this.kv.get(userSessionsKey);
    if (existing) {
      activeSessions = JSON.parse(existing);
    }
    activeSessions.push(sessionId);
    await this.kv.put(userSessionsKey, JSON.stringify(activeSessions));

    // 3. Log to D1 (Audit logging)
    await this.db.execute(
      `INSERT INTO sessions (id, session_id, user_id, device, ip, created_at, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Database.id(), sessionId, userId, device, ip, createdAt, expiresAt]
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.kv.get(`session:${sessionId}`);
    if (!data) return null;
    return JSON.parse(data) as SessionData;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      // Remove from KV
      await this.kv.delete(`session:${sessionId}`);

      // Remove from user index
      const userSessionsKey = `user_sessions:${session.user_id}`;
      const existing = await this.kv.get(userSessionsKey);
      if (existing) {
        let activeSessions: string[] = JSON.parse(existing);
        activeSessions = activeSessions.filter((id) => id !== sessionId);
        await this.kv.put(userSessionsKey, JSON.stringify(activeSessions));
      }
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `user_sessions:${userId}`;
    const existing = await this.kv.get(userSessionsKey);
    if (existing) {
      const activeSessions: string[] = JSON.parse(existing);
      // Delete all token mappings
      for (const sessionId of activeSessions) {
        await this.kv.delete(`session:${sessionId}`);
      }
      // Delete user index
      await this.kv.delete(userSessionsKey);
    }
  }
}
