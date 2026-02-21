import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { UserService } from "../services/user.service";
import { successResponse, errorResponse } from "../lib/response";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().optional()
}).refine(data => data.name !== undefined || data.avatar_url !== undefined, {
  message: "At least one field (name, avatar_url) must be provided"
});

export class UserController {
  static async updateProfile(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const userService = new UserService(db);

    try {
      const body = await c.req.json();
      const parsed = updateProfileSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const success = await userService.updateProfile(session.user_id, parsed.data);
      if (!success) {
        return c.json(errorResponse("NOT_FOUND", "User not found"), 404);
      }

      return c.json(successResponse({ message: "Profile updated successfully" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to update profile"), 500);
    }
  }
}
