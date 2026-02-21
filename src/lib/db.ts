import { D1Database } from "@cloudflare/workers-types";
import { ulid } from "ulidx";

// Simple DB helper since D1 is raw SQLite
export class Database {
  constructor(private db: D1Database) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const { results, success, error } = await this.db.prepare(sql).bind(...params).all<T>();
    if (!success) {
      throw new Error(`DB Query Error: ${error}`);
    }
    return results;
  }

  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const { success, error } = await this.db.prepare(sql).bind(...params).run();
    if (!success) {
      throw new Error(`DB Execute Error: ${error}`);
    }
  }

  // Generates a new ULID
  static id(): string {
    return ulid();
  }

  // Returns current Unix timestamp in ms
  static now(): number {
    return Date.now();
  }
}
