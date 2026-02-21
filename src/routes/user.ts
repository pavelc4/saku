import { Hono } from "hono";
import { UserController } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const users = new Hono();

users.use("*", authMiddleware);

// PUT /users/me
users.put("/me", UserController.updateProfile);

export default users;
