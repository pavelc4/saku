import { Hono } from "hono";
import { ProductCategoryController } from "../controllers/product-category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const products = new Hono();

products.use("*", authMiddleware);

// Product Categories routes
products.get("/categories", ProductCategoryController.list);
products.post("/categories", ProductCategoryController.create);
products.patch("/categories/:id", ProductCategoryController.update);
products.delete("/categories/:id", ProductCategoryController.destroy);

export default products;
