import { Hono } from "hono";
import { ProductCategoryController } from "../controllers/product-category.controller";
import { ProductController } from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const products = new Hono();

products.use("*", authMiddleware);

// Product Categories routes
products.get("/categories", ProductCategoryController.list);
products.post("/categories", ProductCategoryController.create);
products.patch("/categories/:id", ProductCategoryController.update);
products.delete("/categories/:id", ProductCategoryController.destroy);

// Products routes
products.get("/", ProductController.list);
products.get("/:id", ProductController.getById);
products.post("/", ProductController.create);
products.patch("/:id", ProductController.update);
products.delete("/:id", ProductController.destroy);
products.post("/:id/photo", ProductController.uploadPhoto);
products.delete("/:id/photo", ProductController.deletePhoto);
products.patch("/:id/stock", ProductController.overrideStock);

export default products;
