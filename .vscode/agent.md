# SAKU — Sistem Akuntansi Keuangan UMKM

---

## Project Identity

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Name         | SAKU (Sistem Akuntansi Keuangan UMKM)                            |
| Mission      | Simplifying financial records for small businesses using Edge AI |
| Target Users | Indonesian UMKM owners (mobile-first, entry-level devices)       |

---

## Tech Stack

| Layer     | Technology                                    |
| --------- | --------------------------------------------- |
| Runtime   | Bun + Cloudflare Workers                      |
| Framework | Hono                                          |
| Database  | Cloudflare D1 (SQLite)                        |
| Cache     | Cloudflare KV                                 |
| Storage   | Cloudflare R2                                 |
| AI        | Cloudflare Workers AI (Llama 3.1 8B Instruct) |
| Email     | Resend                                        |
| Language  | TypeScript                                    |
| Config    | wrangler.jsonc (NOT wrangler.toml)            |

---

## Implementation Rules

1. **ZERO Pseudocode** — Every function must be fully implemented. Use `// TODO` only for intentionally deferred work with a clear reason.
2. **One Feature at a Time** — Implement ONE feature completely before moving to the next.
3. **Unit Test Before Next Feature** — Write and pass tests before proceeding.
4. **Signed Commits** — Every commit must follow this format:

```
feat(scope): short description

- Added: list what was added
- Changed: list what was changed
- Files: list affected files
```

5. **Design Discussion FIRST** — Always discuss architecture and trade-offs before writing any code.
6. **Ask Before Continuing** — After each feature + tests + commit, explicitly ask before moving to the next step.
7. **No API Versioning** — No `/v1/`, `/v2/` prefixes. Use evolutionary design — breaking changes handled via field additions and deprecation.
8. **No Emoticons** — Never use emoticons or emoji in any response, code comments, commit messages, or documentation.
9. **High-Impact Efficiency**:
   - Use Cloudflare KV to cache sessions and broadcasts to minimize D1 hits
   - Use `db.batch()` for multiple D1 operations
   - Optimize JSON payloads for mobile-first users

---

## Project Structure

```
saku/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── finance.ts
│   │   ├── ai.ts
│   │   └── admin.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── finance.controller.ts
│   │   ├── ai.controller.ts
│   │   └── admin.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── admin.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── services/
│   │   ├── session.service.ts
│   │   ├── email.service.ts
│   │   ├── storage.service.ts
│   │   └── ai.service.ts
│   ├── lib/
│   │   └── db.ts
│   └── index.ts
├── migrations/
│   └── schema.sql
├── wrangler.jsonc
├── worker-configuration.d.ts
├── tsconfig.json
├── package.json
└── .dev.vars
```

---

## Cloudflare Bindings

```typescript
interface Env {
  DB: D1Database;
  SESSION_KV: KVNamespace; // session:{session_id} -> session data, TTL 7 days
  BROADCAST_KV: KVNamespace; // broadcast:{id} -> announcement message
  VERIFY_KV: KVNamespace; // verify:{token} -> user_id, TTL 24 hours
  RECEIPTS_BUCKET: R2Bucket;
  AI: Ai;
  APP_ENV: "development" | "production";
  APP_URL: string;
  CORS_ORIGIN: string;
  RESEND_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}
```

---

## Database Schema

### Conventions

| Field Type  | Convention                                                |
| ----------- | --------------------------------------------------------- |
| IDs         | TEXT (ULID format)                                        |
| Timestamps  | INTEGER (Unix epoch milliseconds)                         |
| Amounts     | INTEGER (rupiah, no float — UMKM IDR only, no sub-rupiah) |
| Soft delete | `deleted_at INTEGER` nullable                             |
| Booleans    | INTEGER 0/1                                               |

### Tables

- `users` — auth + profile + role + ban status
- `sessions` — audit log only (hot path via KV, NOT D1)
- `categories` — system defaults (user_id NULL) + custom user categories
- `transactions` — core finance data
- `transaction_items` — POS mode item detail (snapshot price + name)
- `products` — optional product catalog for POS mode
- `ai_insights_cache` — cached AI insights per user per period

---

## Standard Response Format

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": "error_code",
  "message": "Human readable description"
}
```

### Paginated

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "next_cursor": "string | null",
    "has_more": true
  }
}
```

**Pagination strategy:** cursor-based only (no offset). Cursor is the last item's ULID — efficient for D1 SQLite and prevents page drift.

---

## Architecture Decisions

### Auth

| Decision            | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Session type        | Opaque token (32-byte random hex), NOT JWT                                               |
| Session storage     | KV primary (hot path), D1 sessions table for audit log only                              |
| Multiple devices    | Allowed — one user can have multiple active sessions                                     |
| KV key — session    | `session:{session_id}` -> `{ user_id, role, email, device, ip, created_at, expires_at }` |
| KV key — user index | `user_sessions:{user_id}` -> `[session_id_1, session_id_2, ...]`                         |
| Session TTL         | 7 days (auto-expire in KV)                                                               |
| Revocation          | `KV.delete()` — instant, no D1 query needed                                              |
| Ban user            | Delete all sessions from KV + set `is_banned=1` in D1                                    |
| Roles               | `"user"` or `"admin"`                                                                    |
| OAuth providers     | Google, GitHub (in addition to manual email/password)                                    |
| OAuth callbacks     | `GET /auth/google/callback` and `GET /auth/github/callback`                              |
| Email verify        | Token stored in VERIFY_KV with 24h TTL, sent via Resend                                  |

### Rate Limiting

| Field          | Value                                        |
| -------------- | -------------------------------------------- |
| Strategy       | KV-based counter per IP per endpoint         |
| Implementation | `rate-limit.middleware.ts`                   |
| Applied to     | `/auth/login`, `/auth/register`, `/ai/parse` |
| KV key pattern | `rl:{endpoint}:{ip}` -> request count        |
| TTL            | 60 seconds window                            |
| Limits         | login=5/min, register=3/min, ai_parse=10/min |

### Categories

- System defaults: `user_id IS NULL`, visible to all, read-only for users
- Custom categories: `user_id = owner`, full CRUD by owner only
- Soft delete: `deleted_at` column
- Fields: `name`, `icon` (emoji), `color` (hex), `type` (income/expense/both)

### Transactions

- Amount: INTEGER rupiah (no floating point)
- Source tracking: `"manual"` or `"ai_parsed"`
- Receipt upload: Direct via Worker to R2, max 5MB, allowed: jpeg/png/webp/pdf
- Soft delete: `deleted_at` column
- Pagination: cursor-based

### Products & POS Mode

- POS is optional — auto-activated when user has at least 1 product
- No manual toggle — frontend detects via product count
- Price snapshot: `transaction_items` stores name + price at time of transaction
- Fields: `name`, `price` (sell), `cost` (optional, for margin calc), `is_active`

### Summary / Dashboard

- Pure math, no AI, realtime
- Endpoint: `GET /finance/summary?period=today|week|month|year`
- Returns: `total_income`, `total_expense`, `net`, `transaction_count`

### Export

- Format: CSV
- Scope: Per period, user's own data only

### AI Brain — Smart Record

- Input language: Indonesian + English + mixed (bilingual prompt)
- Flow: AI parse -> Zod validation -> return preview -> user confirms -> POST /transactions
- Fallback chain: Workers AI (JSON mode) -> rule-based regex parser -> partial form (never dead end)
- Never auto-insert: Always return preview, user must confirm

Response schema:

```json
{
  "success": true,
  "data": {
    "confidence": "full | partial | failed",
    "type": "expense | income | null",
    "amount": "number | null",
    "description": "string | null",
    "category_suggestion": "string | null",
    "note": "string"
  }
}
```

### AI Brain — Period Insights

| Field                         | Value                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Periods                       | daily, weekly, monthly, yearly                                                       |
| Cache TTL — daily             | 1 hour                                                                               |
| Cache TTL — weekly            | 12 hours                                                                             |
| Cache TTL — monthly (current) | 24 hours                                                                             |
| Cache TTL — monthly (past)    | 30 days                                                                              |
| Cache TTL — yearly (current)  | 30 days                                                                              |
| Cache TTL — yearly (past)     | permanent                                                                            |
| Minimum transactions          | 3 required for AI narrative (else return aggregation only)                           |
| Data flow                     | Aggregate transactions FIRST — send summary to AI, NOT raw rows                      |
| Previous period               | Always include prev_period totals for anomaly detection                              |
| Cache key                     | UNIQUE(user_id, period_type, period_key)                                             |
| period_key format             | daily=`2026-02-22`, weekly=`2026-W08` (ISO 8601), monthly=`2026-02`, yearly=`2026`   |
| ISO week edge case            | Use ISO 8601 strictly — week 1 is the week containing the first Thursday of the year |

### Admin

- Broadcast: Global only (all users), maintenance/announcement purpose
- Broadcast storage: BROADCAST_KV
- Ban: Includes `ban_reason`, instant session revocation for all user devices
- Password reset: Admin-forced reset

---

## Milestones

| No  | Name            | Scope                                                                                     |
| --- | --------------- | ----------------------------------------------------------------------------------------- |
| 1   | Init & DB Setup | wrangler.jsonc, migrations/schema.sql, tsconfig, project structure, standard error format |
| 2   | Auth            | Register, Login, Email Verify, Google+GitHub OAuth, Session management, Rate limiting     |
| 3   | Categories      | CRUD custom + read system defaults                                                        |
| 4   | Transactions    | CRUD + R2 receipt upload + summary endpoint + cursor pagination                           |
| 4.5 | Export          | CSV export per period                                                                     |
| 5   | Products & POS  | Product CRUD + quick transaction (POS mode)                                               |
| 6   | AI Brain        | Smart Record + Period Insights                                                            |
| 7   | Admin           | Ban/Unban, Global Broadcast, Password Reset, View Sessions                                |

---

## Workflow Per Feature

For every single feature, follow this exact order:

1. Discuss architecture and trade-offs (no code yet)
2. Implement the feature fully (zero pseudocode, zero placeholder)
3. Write unit tests
4. Run tests — only continue if all pass
5. Signed commit with clear message
6. Ask user before moving to next feature

---

## Communication Style

- Language: Casual technical Indonesian (English only when technically clearer)
- Style: Direct, no fluff, production-ready code
- No emoticons: Never use emoticons or emoji anywhere
- Approach: Explain WHY not just WHAT — highlight gotchas and edge cases
- Code comments: Inline only for tricky parts, not obvious logic
- Architecture: Always discuss trade-offs before implementing
- Steps: ONE feature at a time, ask before continuing

---

## Current Status

No implementation has been done yet. Everything so far is architecture design only.
Milestone 1 (Init & DB Setup) is designed but NOT yet implemented.
**Start from Milestone 1 when implementation begins.**

---

## Known Limitations

**Receipt upload via direct Worker stream** — acceptable for current scope (max 5MB).
If users report upload timeouts or failures on larger files or slow connections, the fix is to migrate to R2 presigned URL — Worker only generates the URL, client uploads directly to R2 without passing through the Worker. This is a known trade-off, not a bug.
