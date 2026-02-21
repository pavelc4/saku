import { Hono } from "hono";
import { CategoryController } from "../controllers/category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const categories = new Hono();

// All category routes require authentication
categories.use("*", authMiddleware);

categories.get("/", CategoryController.list);
categories.post("/", CategoryController.create);
categories.put("/:id", CategoryController.update);
categories.delete("/:id", CategoryController.destroy);

export default categories;
