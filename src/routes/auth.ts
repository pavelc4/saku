import { Hono } from "hono";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const auth = new Hono();

// Public routes
auth.post("/register", AuthController.register);
auth.get("/verify", AuthController.verifyEmail);
auth.post("/login", AuthController.login);

// Protected routes
auth.use("/me", authMiddleware);
auth.get("/me", AuthController.getMe);

auth.use("/logout", authMiddleware);
auth.post("/logout", AuthController.logout);

export default auth;
