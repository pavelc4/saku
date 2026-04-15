import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth";
import categories from "./routes/category";
import transactions from "./routes/transaction";
import users from "./routes/user";
import insights from "./routes/insight";
import products from "./routes/products";
import productCategories from "./routes/product-categories";
import pos from "./routes/pos";
import { Env } from "../worker-configuration";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

app.get("/", (c) => c.text("SAKU API v1.0"));

app.route("/auth", auth);
app.route("/users", users);
app.route("/categories", categories);
app.route("/transactions", transactions);
app.route("/insights", insights);
app.route("/products/categories", productCategories);
app.route("/products", products);
app.route("/pos", pos);

// Cron handler for auto-confirming pending POS transactions
async function autoConfirmPendingTransactions(env: Env): Promise<void> {
  const now = Date.now();
  // Grace period: 1 hour (don't confirm transactions created in the last hour)
  const oneHourAgo = now - 3600000;

  try {
    // Auto-confirm all pending POS transactions older than 1 hour
    await env.DB.prepare(`
      UPDATE transactions
      SET status = 'confirmed', updated_at = ?
      WHERE status = 'pending'
        AND source = 'pos'
        AND deleted_at IS NULL
        AND created_at < ?
    `).bind(now, oneHourAgo).run();

    // Auto-close all open POS sessions older than 1 hour
    await env.DB.prepare(`
      UPDATE pos_sessions
      SET closed_at = ?
      WHERE closed_at IS NULL
        AND opened_at < ?
    `).bind(now, oneHourAgo).run();

    console.log(`[CRON] Auto-confirmed pending transactions and closed open sessions at ${new Date(now).toISOString()}`);
  } catch (error) {
    console.error('[CRON] Error auto-confirming transactions:', error);
  }
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(autoConfirmPendingTransactions(env));
  },
};

