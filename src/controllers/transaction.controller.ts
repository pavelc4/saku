import { Context } from "hono";
import { z } from "zod";
import { Database } from "../lib/db";
import { TransactionService, CreateTransactionDTO, CreateTransactionItemDTO } from "../services/transaction.service";
import { errorResponse, successResponse, paginatedResponse } from "../lib/response";

// Zod schemas
const transactionItemSchema = z.object({
  product_id: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().int(),
});

const createTransactionSchema = z.object({
  category_id: z.string().min(1),
  type: z.enum(["income", "expense"]),
  amount: z.number().int(),
  date: z.number().int(),
  note: z.string().optional(),
  source: z.enum(["manual", "ai_parsed"]).optional(),
  items: z.array(transactionItemSchema).optional()
});

const updateTransactionSchema = z.object({
  category_id: z.string().min(1).optional(),
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().int().optional(),
  date: z.number().int().optional(),
  note: z.string().optional(),
});

export class TransactionController {

  static async list(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);
    
    const cursor = c.req.query("cursor");
    const limit = parseInt(c.req.query("limit") || "20", 10);

    try {
      const result = await ts.listTransactions(session.user_id, cursor, limit > 100 ? 100 : limit);
      return c.json(paginatedResponse(result.data, result.nextCursor, !!result.nextCursor));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to list transactions"), 500);
    }
  }

  static async create(c: Context) {
    const session = c.get("session");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    try {
      const body = await c.req.json();
      const parsed = createTransactionSchema.safeParse(body);
      
      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const txn = await ts.createTransaction(session.user_id, parsed.data as CreateTransactionDTO);
      return c.json(successResponse(txn), 201);
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to create transaction"), 500);
    }
  }

  static async update(c: Context) {
    const session = c.get("session");
    const txnId = c.req.param("id");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    try {
      const body = await c.req.json();
      const parsed = updateTransactionSchema.safeParse(body);
      
      if (!parsed.success) {
        return c.json(errorResponse("BAD_REQUEST", "Validation failed"), 400);
      }

      const success = await ts.updateTransactionBasic(session.user_id, txnId, parsed.data);
      if (!success) {
         return c.json(errorResponse("NOT_FOUND", "Transaction not found or forbidden"), 404);
      }

      return c.json(successResponse({ message: "Transaction updated" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to update transaction"), 500);
    }
  }

  static async destroy(c: Context) {
    const session = c.get("session");
    const txnId = c.req.param("id");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    try {
      const success = await ts.deleteTransaction(session.user_id, txnId);
      if (!success) {
         return c.json(errorResponse("NOT_FOUND", "Transaction not found or forbidden"), 404);
      }

      return c.json(successResponse({ message: "Transaction deleted" }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to delete transaction"), 500);
    }
  }

  static async summary(c: Context) {
    const session = c.get("session");
    const period = c.req.query("period") || "month"; // today, week, month, year
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    const now = new Date();
    let start = new Date();
    start.setHours(0, 0, 0, 0); // Start of today

    if (period === "week") {
      const day = start.getDay() || 7; // Get current day number, convert Sun(0) to 7
      start.setHours(-24 * (day - 1)); // Set to Monday of this week
    } else if (period === "month") {
      start.setDate(1); // Start of month
    } else if (period === "year") {
      start.setMonth(0, 1); // Start of year
    }

    try {
      const result = await ts.getSummary(session.user_id, start.getTime(), now.getTime());
      return c.json(successResponse(result));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to fetch summary"), 500);
    }
  }

  static async uploadReceipt(c: Context) {
    const session = c.get("session");
    const txnId = c.req.param("id");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    try {
      const txn = await ts.getTransactionById(session.user_id, txnId);
      if (!txn) {
        return c.json(errorResponse("NOT_FOUND", "Transaction not found"), 404);
      }

      // Parse multipart form data
      const body = await c.req.parseBody();
      const file = body["receipt"];

      if (!file || !(file instanceof File)) {
        return c.json(errorResponse("BAD_REQUEST", "No receipt file uploaded"), 400);
      }

      // Check size (5MB Limit)
      if (file.size > 5 * 1024 * 1024) {
        return c.json(errorResponse("BAD_REQUEST", "File size exceeds 5MB limit"), 400);
      }

      // Check format
      const allowedFormats = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedFormats.includes(file.type)) {
        return c.json(errorResponse("BAD_REQUEST", "Invalid file format"), 400);
      }

      // Upload to R2
      const env = c.env as any;
      const ext = file.name.split('.').pop();
      const fileKey = `receipts/${session.user_id}/${txnId}_${Database.id()}.${ext}`;
      
      await env.RECEIPTS_BUCKET.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      // Update DB
      await ts.updateReceiptUrl(session.user_id, txnId, fileKey);

      return c.json(successResponse({ message: "Receipt uploaded successfully", url: fileKey }));
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to upload receipt"), 500);
    }
  }

  static async getReceipt(c: Context) {
    const session = c.get("session");
    const txnId = c.req.param("id");
    const db = new Database(c.env.DB);
    const ts = new TransactionService(db);

    try {
      const txn = await ts.getTransactionById(session.user_id, txnId);
      if (!txn || !txn.receipt_file_url) {
        return c.json(errorResponse("NOT_FOUND", "Receipt not found"), 404);
      }

      const env = c.env as any;
      const object = await env.RECEIPTS_BUCKET.get(txn.receipt_file_url);

      if (object === null) {
        return c.json(errorResponse("NOT_FOUND", "Receipt file not found in storage"), 404);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      
      // Cache control can be added if needed, but since it's an authenticated route, maybe skip or private caching
      headers.set("Cache-Control", "private, max-age=3600");

      return new Response(object.body, { headers });
    } catch (e: any) {
      console.error(e);
      return c.json(errorResponse("INTERNAL_ERROR", "Failed to retrieve receipt"), 500);
    }
  }
}
