import { Hono } from "hono";
import { TransactionController } from "../controllers/transaction.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const transactions = new Hono();

transactions.use("*", authMiddleware);

transactions.get("/", TransactionController.list);
transactions.post("/", TransactionController.create);
transactions.get("/summary", TransactionController.summary);
transactions.put("/:id", TransactionController.update);
transactions.delete("/:id", TransactionController.destroy);

// Receipt endpoints
transactions.post("/:id/receipt", TransactionController.uploadReceipt);
transactions.get("/:id/receipt", TransactionController.getReceipt);

export default transactions;
