import { Hono } from "hono";
import { authMiddleware } from "../middlewares/auth.middleware";
import { ProductCategoryController } from "../controllers/product-category.controller";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", ProductCategoryController.list);
router.post("/", ProductCategoryController.create);
router.patch("/:id", ProductCategoryController.update);
router.delete("/:id", ProductCategoryController.destroy);

export default router;
