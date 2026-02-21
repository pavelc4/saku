import { Hono } from "hono";
import { InsightController } from "../controllers/insight.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const insights = new Hono();

insights.use("*", authMiddleware);

insights.get("/monthly", InsightController.getMonthlyInsight);

export default insights;
