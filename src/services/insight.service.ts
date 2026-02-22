import { Database } from "../lib/db";
import { buildSystemPrompt, buildUserPrompt } from "../prompts/insights.prompt";
import { insightConfig } from "../prompts/insights.config";

interface InsightCache {
  id: string;
  insight_data: string;
  created_at: number;
}

export class InsightService {
  constructor(private db: Database, private ai: any) {}

  async getMonthlyInsight(userId: string, year: number, month: number, forceRefresh: boolean = false, lang: 'id' | 'en' = 'id'): Promise<string> {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    // Context format: YYYY-MM
    const periodHash = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Check Cache
    if (!forceRefresh) {
      const cache = await this.db.queryFirst<InsightCache>(
         `SELECT id, insight_data, created_at FROM ai_insights_cache WHERE user_id = ? AND period_type = 'monthly' AND period_key = ? ORDER BY created_at DESC LIMIT 1`,
         [userId, periodHash]
      );
      if (cache) {
        return cache.insight_data;
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

    const summary = {
      income,
      expense,
      categories: categoryData,
      note: income === 0 && expense === 0 ? "No transactions found for this month." : undefined
    };

    const systemPrompt = buildSystemPrompt(lang);
    const userPrompt = buildUserPrompt({ lang, summary, month, year });

    // Call Cloudflare AI
    const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: insightConfig.verbosity === 'brief' ? 512 : 1024,
    });

    const aiResponseText = response.response || "Unable to process insights at this time.";

    // Store in cache
    const newCacheId = Database.id();
    const now = Database.now();
    await this.db.execute(
      `INSERT INTO ai_insights_cache (id, user_id, period_type, period_key, insight_data, created_at, updated_at) VALUES (?, ?, 'monthly', ?, ?, ?, ?)
       ON CONFLICT(user_id, period_type, period_key) DO UPDATE SET insight_data = excluded.insight_data, updated_at = excluded.updated_at`,
       [newCacheId, userId, periodHash, aiResponseText, now, now]
    );

    return aiResponseText;
  }
}
