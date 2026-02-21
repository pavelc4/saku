import { Context } from "hono";
import { Database } from "../lib/db";
import { InsightService } from "../services/insight.service";
import { successResponse, errorResponse } from "../lib/response";

export class InsightController {
  static async getMonthlyInsight(c: Context) {
    const session = c.get("session");
    
    const now = new Date();
    const monthStr = c.req.query("month");
    const yearStr = c.req.query("year");
    const forceRefresh = c.req.query("force_refresh") === "true";

    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
      return c.json(errorResponse("BAD_REQUEST", "Invalid month or year parameters"), 400);
    }

    const db = new Database(c.env.DB);
    const insightService = new InsightService(db, c.env.AI);

    try {
      const insight = await insightService.getMonthlyInsight(session.user_id, year, month, forceRefresh);
      return c.json(successResponse({ insight, period: { month, year } }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to generate monthly insight"), 500);
    }
  }
}
