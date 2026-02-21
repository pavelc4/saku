import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { SessionService } from "../services/session.service";

export async function authMiddleware(c: Context, next: Next) {
  // Mobile-first: check Bearer token first, then fallback to cookie (if needed for testing/web)
  const authHeader = c.req.header("Authorization");
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    // Optional web fallback
    token = getCookie(c, "saku_session") || "";
  }

  if (!token) {
    return c.json({ success: false, error: "UNAUTHORIZED", message: "Token is missing" }, 401);
  }

  // Retrieve session
  const env = c.env as any; // Cast for now, will be bound in index
  const sessionService = new SessionService(env.SESSION_KV, env.DB); // Need to instantiate DB properly, usually injected

  try {
    const session = await sessionService.getSession(token);
    
    if (!session) {
      return c.json({ success: false, error: "UNAUTHORIZED", message: "Invalid or expired session" }, 401);
    }
    
    // Attach to context
    c.set("session", session);
    c.set("token", token);
    
    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json({ success: false, error: "INTERNAL_ERROR", message: "Failed to authenticate session" }, 500);
  }
}
