import { Context } from "hono";
import { Database } from "../lib/db";
import { SessionService } from "../services/session.service";
import { EmailService } from "../services/email.service";
import { OAuthService } from "../services/oauth.service";
import { generateOpaqueToken, hashPassword, verifyPassword } from "../lib/crypto";
import { errorResponse, successResponse } from "../lib/response";

export class AuthController {
  
  static async register(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const emailService = new EmailService(env.RESEND_API_KEY, env.EMAIL_SENDER);
    
    try {
      const body = await c.req.json();
      const { email, password, name } = body;
      
      if (!email || !password || !name) {
        return c.json(errorResponse("BAD_REQUEST", "Email, password, and name are required"), 400);
      }

      // Check if user exists
      const existingUser = await db.queryFirst(`SELECT id FROM users WHERE email = ?`, [email]);
      if (existingUser) {
        return c.json(errorResponse("CONFLICT", "Email is already registered"), 409);
      }

      const userId = Database.id();
      const hashedPassword = await hashPassword(password);
      const now = Database.now();

      // Create User (email_verified defaults to 0)
      await db.execute(
        `INSERT INTO users (id, email, password_hash, name, role, is_banned, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', 0, 0, ?, ?)`,
        [userId, email, hashedPassword, name, now, now]
      );

      // Create Verification Token
      const verifyToken = generateOpaqueToken();
      
      // TTL 24 hours (86400 seconds)
      await env.VERIFY_KV.put(`verify:${verifyToken}`, userId, { expirationTtl: 86400 });

      // Send Email
      const verifyUrl = `${env.APP_URL}/auth/verify?token=${verifyToken}`;
      await emailService.sendVerificationEmail(email, verifyUrl);

      return c.json(successResponse({ message: "Registration successful. Please check your email to verify." }), 201);
    } catch (err: any) {
      console.error(err);
      return c.json(errorResponse("INTERNAL_ERROR", "Registration failed"), 500);
    }
  }

  static async verifyEmail(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const token = c.req.query("token");

    if (!token) {
      return c.redirect(`${env.FRONTEND_URL}/auth/verify?status=error&message=Token tidak ditemukan`);
    }

    try {
      const key = `verify:${token}`;
      const userId = await env.VERIFY_KV.get(key);

      if (!userId) {
        return c.redirect(`${env.FRONTEND_URL}/auth/verify?status=error&message=Token tidak valid atau sudah kadaluarsa`);
      }

      // Update user status
      await db.execute(`UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?`, [Database.now(), userId]);
      
      // Delete token from KV
      await env.VERIFY_KV.delete(key);

      return c.redirect(`${env.FRONTEND_URL}/auth/verify?status=success`);
    } catch (err: any) {
      console.error(err);
      return c.redirect(`${env.FRONTEND_URL}/auth/verify?status=error&message=Terjadi kesalahan saat verifikasi`);
    }
  }

  static async login(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const sessionService = new SessionService(env.SESSION_KV, db);

    try {
      const body = await c.req.json();
      const { email, password, device } = body;
      
      if (!email || !password) {
        return c.json(errorResponse("BAD_REQUEST", "Email and password are required"), 400);
      }

      // Fetch user
      const user = await db.queryFirst(`SELECT id, password_hash, role, is_banned, email_verified FROM users WHERE email = ?`, [email]);
      
      if (!user) {
         // Return generic error for security
        return c.json(errorResponse("UNAUTHORIZED", "Invalid email or password"), 401);
      }

      if (user.is_banned === 1) {
        return c.json(errorResponse("FORBIDDEN", "This account has been banned"), 403);
      }

      if (user.email_verified === 0) {
        return c.json(errorResponse("FORBIDDEN", "Please verify your email address before logging in"), 403);
      }

      // Verify Password
      if (!user.password_hash) {
        // Probably an OAuth user trying to use password
        return c.json(errorResponse("UNAUTHORIZED", "Invalid email or password"), 401);
      }

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return c.json(errorResponse("UNAUTHORIZED", "Invalid email or password"), 401);
      }

      // Create session
      const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || undefined;
      const sessionId = await sessionService.createSession(user.id, email, user.role, device, ip);

      return c.json(successResponse({ token: sessionId }));
    } catch (err: any) {
      console.error(err);
      return c.json(errorResponse("INTERNAL_ERROR", "Login failed"), 500);
    }
  }

  static async logout(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const sessionService = new SessionService(env.SESSION_KV, db);
    const token = c.get("token");

    if (token) {
      await sessionService.revokeSession(token);
    }

    return c.json(successResponse({ message: "Successfully logged out" }));
  }

  static async getMe(c: Context) {
    const session = c.get("session");
    // Should contain subset of session data
    return c.json(successResponse(session));
  }

  // --- OAUTH GOOGLE ---
  static async googleLogin(c: Context) {
    const env = c.env as any;
    const oauthService = new OAuthService(
      env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET,
      env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET,
      env.APP_URL
    );
    return c.redirect(oauthService.getGoogleAuthUrl());
  }

  static async googleCallback(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const sessionService = new SessionService(env.SESSION_KV, db);
    const oauthService = new OAuthService(
      env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET,
      env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET,
      env.APP_URL
    );

    const code = c.req.query("code");
    if (!code) {
      return c.json(errorResponse("BAD_REQUEST", "Missing Google auth code"), 400);
    }

    const googleUser = await oauthService.getGoogleUser(code);
    if (!googleUser || !googleUser.email) {
      return c.json(errorResponse("UNAUTHORIZED", "Failed to retrieve Google profile"), 401);
    }

    return await AuthController.handleOAuthUser(c, db, sessionService, googleUser.email, googleUser.name);
  }

  // --- OAUTH GITHUB ---
  static async githubLogin(c: Context) {
    const env = c.env as any;
    const oauthService = new OAuthService(
      env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET,
      env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET,
      env.APP_URL
    );
    return c.redirect(oauthService.getGithubAuthUrl());
  }

  static async githubCallback(c: Context) {
    const env = c.env as any;
    const db = new Database(env.DB);
    const sessionService = new SessionService(env.SESSION_KV, db);
    const oauthService = new OAuthService(
      env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET,
      env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET,
      env.APP_URL
    );

    const code = c.req.query("code");
    if (!code) {
       return c.json(errorResponse("BAD_REQUEST", "Missing GitHub auth code"), 400);
    }

    const githubUser = await oauthService.getGithubUser(code);
    if (!githubUser || !githubUser.email) {
       return c.json(errorResponse("UNAUTHORIZED", "Failed to retrieve GitHub profile"), 401);
    }

    return await AuthController.handleOAuthUser(c, db, sessionService, githubUser.email, githubUser.name);
  }

  // --- INTERNAL OAUTH HANDLER ---
  private static async handleOAuthUser(c: Context, db: Database, sessionService: SessionService, email: string, name: string) {
    try {
      let user = await db.queryFirst(`SELECT id, role, is_banned FROM users WHERE email = ?`, [email]);

      if (!user) {
        // Register new user via OAuth
        const userId = Database.id();
        const now = Database.now();
        // Null password hash for oauth only
        await db.execute(
          `INSERT INTO users (id, email, name, role, is_banned, email_verified, created_at, updated_at) 
           VALUES (?, ?, ?, 'user', 0, 1, ?, ?)`,
          [userId, email, name, now, now]
        );
        user = { id: userId, role: "user", is_banned: 0 };
      }

      if (user.is_banned === 1) {
         return c.json(errorResponse("FORBIDDEN", "This account has been banned"), 403);
      }

      // Generate session
      const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || undefined;
      const sessionId = await sessionService.createSession(user.id, email, user.role, "oauth-login", ip);

      // Redirect client on success
      const env = c.env as any;
      return c.redirect(`${env.FRONTEND_URL || env.APP_URL}/oauth/success?token=${sessionId}`);
    } catch (err: any) {
      console.error(err);
      return c.json(errorResponse("INTERNAL_ERROR", "OAuth login failed"), 500);
    }
  }
}
