import { Hono } from "hono";
import { POSController } from "../controllers/pos.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const pos = new Hono();

pos.use("*", authMiddleware);

// POS Session routes
pos.get("/session/active", POSController.getSession);
pos.post("/session/open", POSController.openSession);
pos.post("/session/close", POSController.closeSession);

// POS Checkout
pos.post("/checkout", POSController.checkout);

// POS Transaction management
pos.patch("/transactions/:id", POSController.editTransaction);
pos.delete("/transactions/:id", POSController.cancelTransaction);

// POS Summary
pos.get("/summary/today", POSController.getSummaryToday);

export default pos;
