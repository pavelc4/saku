import { Hono } from "hono";
import { ProductController } from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const products = new Hono();

products.use("*", authMiddleware);

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
