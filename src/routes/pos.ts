import { Hono } from "hono";
import { POSController } from "../controllers/pos.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const pos = new Hono();

pos.use("*", authMiddleware);

// POS Session routes
pos.get("/session", POSController.getSession);
pos.post("/open", POSController.openSession);
pos.post("/close", POSController.closeSession);
pos.post("/checkout", POSController.checkout);

// POS Transaction management
pos.patch("/transactions/:id", POSController.editTransaction);
pos.delete("/transactions/:id", POSController.cancelTransaction);

export default pos;
