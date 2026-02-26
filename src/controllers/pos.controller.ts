import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { POSService } from "../services/pos.service";
import { errorResponse, successResponse } from "../lib/response";

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().int().positive().max(9999),
  })).min(1),
  payment_method: z.enum(['cash', 'transfer', 'qris']),
  note: z.string().max(255).optional().nullable(),
  category_id: z.string().optional().nullable(),
});

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

  static async checkout(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const posService = new POSService(db);

    try {
      const body = await c.req.json();
      const parsed = checkoutSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const result = await posService.checkout(
        session.user_id,
        parsed.data.items,
        parsed.data.payment_method,
        parsed.data.category_id || null,
        parsed.data.note || null
      );

      return c.json(successResponse(result), 201);
    } catch (e: any) {
      console.error(e);
      
      if (e.message === "KASIR_BELUM_DIBUKA") {
        return c.json(errorResponse("BAD_REQUEST", "Kasir belum dibuka"), 400);
      }

      if (e.message === "PRODUCT_NOT_FOUND") {
        return c.json(errorResponse("NOT_FOUND", "Satu atau lebih produk tidak ditemukan"), 404);
      }

      if (e.message.startsWith("PRODUCT_INACTIVE")) {
        return c.json(errorResponse("BAD_REQUEST", e.message.replace("PRODUCT_INACTIVE: ", "Produk tidak aktif: ")), 400);
      }

      if (e.message === "INSUFFICIENT_STOCK") {
        return c.json({
          success: false,
          error: "INSUFFICIENT_STOCK",
          message: "Stok tidak mencukupi",
          details: e.details
        }, 400);
      }

      return c.json(errorResponse("INTERNAL_ERROR", "Failed to process checkout"), 500);
    }
  }
}
