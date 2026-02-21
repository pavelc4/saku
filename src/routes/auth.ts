import { Hono } from "hono";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { rateLimit } from "../middlewares/rate-limit.middleware";

const auth = new Hono();

// Public routes with Rate Limiting
auth.post("/register", rateLimit("register", 3), AuthController.register);
auth.post("/login", rateLimit("login", 5), AuthController.login);
auth.get("/verify", AuthController.verifyEmail);

// OAuth routes
auth.get("/google", AuthController.googleLogin);
auth.get("/google/callback", AuthController.googleCallback);

auth.get("/github", AuthController.githubLogin);
auth.get("/github/callback", AuthController.githubCallback);

// Protected routes
auth.use("/me", authMiddleware);
auth.get("/me", AuthController.getMe);

auth.use("/logout", authMiddleware);
auth.post("/logout", AuthController.logout);

export default auth;
