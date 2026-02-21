import { Database } from "../lib/db";

interface InsightCache {
  id: string;
  response: string;
  created_at: number;
}

export class InsightService {
  constructor(private db: Database, private ai: any) {}

  async getMonthlyInsight(userId: string, year: number, month: number, forceRefresh: boolean = false): Promise<string> {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    // Context format: YYYY-MM
    const periodHash = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Check Cache
    if (!forceRefresh) {
      const cache = await this.db.queryFirst<InsightCache>(
         `SELECT id, response, created_at FROM ai_insights_cache WHERE user_id = ? AND prompt_hash = ? ORDER BY created_at DESC LIMIT 1`,
         [userId, periodHash]
      );
      if (cache) {
        return cache.response;
      }
    }

    // Generate new Insight
    // Aggregate Data
    const summaryData = await this.db.queryFirst<{ income: number; expense: number }>(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions 
      WHERE user_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL
    `, [userId, start, end]);

    const income = summaryData?.income || 0;
    const expense = summaryData?.expense || 0;
    
    // Aggregate categories
    const categoryData = await this.db.query<{ name: string; total: number }>(`
      SELECT c.name, SUM(t.amount) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ? AND t.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 3
    `, [userId, start, end]);

    let promptData = `Pemasukan: Rp${income}\nPengeluaran: Rp${expense}\n`;
    if (categoryData.length > 0) {
      promptData += `Kategori Pengeluaran Terbesar:\n`;
      categoryData.forEach((c, idx) => {
        promptData += `${idx + 1}. ${c.name}: Rp${c.total}\n`;
      });
    }

    if (income === 0 && expense === 0) {
       promptData += "Belum ada transaksi di bulan ini.";
    }

    // Call Cloudflare AI Limit tokens
    const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { 
          role: "system", 
          content: "Kamu adalah asisten keuangan pribadi bernama SAKU yang ramah dan suportif. Berikan ringkasan keuangan bulanan dalam 3-4 kalimat pendek berbahasa Indonesia berdasarkan data yang diberikan. Beri saran singkat. Jangan gunakan markup rumit." 
        },
        { role: "user", content: promptData }
      ]
    });

    const aiResponseText = response.response || "Tidak dapat memproses insight saat ini.";

    // Store in cache
    const newCacheId = Database.id();
    const now = Database.now();
    await this.db.execute(
      `INSERT INTO ai_insights_cache (id, user_id, period_start, period_end, prompt_hash, response, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
       [newCacheId, userId, start, end, periodHash, aiResponseText, now]
    );

    return aiResponseText;
  }
}
