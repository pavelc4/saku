import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth";
import categories from "./routes/category";
import transactions from "./routes/transaction";
import users from "./routes/user";
import insights from "./routes/insight";
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

export default app;
