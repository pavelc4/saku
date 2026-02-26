import { Context } from "hono";
import { Database } from "../lib/db";
import { POSService } from "../services/pos.service";
import { errorResponse, successResponse } from "../lib/response";

export class POSController {
  static async getSession(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const posService = new POSService(db);

    try {
      const activeSession = await posService.getActiveSession(session.user_id);
      return c.json(successResponse(activeSession));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to get POS session"), 500);
    }
  }

  static async openSession(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const posService = new POSService(db);

    try {
      const posSession = await posService.openSession(session.user_id);
      return c.json(successResponse(posSession), 201);
    } catch (e: any) {
      console.error(e);
      if (e.message === "ACTIVE_SESSION_EXISTS") {
        const activeSession = await posService.getActiveSession(session.user_id);
        return c.json({
          success: false,
          error: "CONFLICT",
          message: "Kasir sudah dibuka",
          data: activeSession
        }, 409);
      }
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to open POS session"), 500);
    }
  }

  static async closeSession(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const posService = new POSService(db);

    try {
      const closedSession = await posService.closeSession(session.user_id);
      return c.json(successResponse(closedSession));
    } catch (e: any) {
      console.error(e);
      if (e.message === "NO_ACTIVE_SESSION") {
        return c.json(errorResponse("BAD_REQUEST", "Tidak ada kasir yang aktif"), 400);
      }
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to close POS session"), 500);
    }
  }
}
