import { Database } from "../lib/db";

export interface UpdateProfileDTO {
  name?: string;
  avatar_url?: string;
}

export class UserService {
  constructor(private db: Database) {}

  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<boolean> {
    const existing = await this.db.queryFirst(`SELECT id FROM users WHERE id = ?`, [userId]);
    if (!existing) return false;

    const updates: string[] = [];
    const values: any[] = [];
    const now = Database.now();

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    
    if (data.avatar_url !== undefined) {
      updates.push("avatar_url = ?");
      values.push(data.avatar_url);
    }

    if (updates.length === 0) return true;

    updates.push("updated_at = ?");
    values.push(now);
    values.push(userId);

    await this.db.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    return true;
  }
}
