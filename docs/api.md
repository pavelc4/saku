# SAKU API Documentation

All API endpoints by default respond with the standard Response structure:

```json
{
  "success": true, // or false
  "data": { ... }, // Omitted if error
  "error": "ERROR_CODE", // Present if success = false
  "message": "Human readable message"
}
```

Paginated endpoints respond with:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "next_cursor": "ulid_string",
    "has_more": true
  }
}
```

Most endpoints require authentication. Pass the session token in the header:
`Authorization: Bearer <your_session_token>`

---

## 🔐 Auth Endpoints

### `POST /auth/register`

Creates a new user account.

- **Body**: `{ "email": "x@x.com", "password": "...", "name": "John" }`
- Rate-limited: Maximum 3 times per minute.

### `POST /auth/login`

Logs in a user and creates a session.

- **Body**: `{ "email": "x@x.com", "password": "..." }`
- **Response**: `{ "data": { "token": "session_string", "user": {...} } }`
- Rate-limited: Maximum 5 times per minute.

### `GET /auth/verify?token=...`

Verifies an email address using the token sent via email.

### `GET /auth/me`

_(Requires Auth)_
Returns the currently logged-in user's data from the session.

### `POST /auth/logout`

_(Requires Auth)_
Revokes the current session token from the KV store and D1 audit log.

### OAuth Endpoints

- `GET /auth/google` - Redirect to Google consent screen.
- `GET /auth/google/callback` - Handling callback.
- `GET /auth/github` - Redirect to GitHub consent screen.
- `GET /auth/github/callback` - Handling callback.

---

## 👤 User Endpoints

### `PUT /users/me`

_(Requires Auth)_
Updates the user's profile settings.

- **Body**: `{ "name"?: "New Name", "avatar_url"?: "https://..." }`

---

## 🗂️ Categories Endpoints

### `GET /categories`

_(Requires Auth)_
Lists all system default categories and the user's custom categories.

### `POST /categories`

_(Requires Auth)_
Create a new custom category.

- **Body**: `{ "name": "...", "type": "income" | "expense" | "both", "color": "#HEX", "icon": "emoji" }`

### `PUT /categories/:id`

_(Requires Auth)_
Update a custom category you own. Returns 403 if attempting to edit a System Category.

### `DELETE /categories/:id`

_(Requires Auth)_
Soft-deletes a custom category.

---

## 💸 Transactions Endpoints

### `POST /transactions`

_(Requires Auth)_
Creates a new transaction and its items atomically.

- **Body**:
  ```json
  {
    "category_id": "...",
    "type": "income" | "expense",
    "amount": 150000,
    "date": 1700000000000,
    "note": "Optional desc",
    "items": [
      { "name": "Nasi Goreng", "quantity": 1, "price": 150000 }
    ]
  }
  ```

### `GET /transactions`

_(Requires Auth)_
Lists paginated transactions.

- **Query Params**: `?cursor=<ulid>&limit=20`

### `GET /transactions/summary`

_(Requires Auth)_
Aggregate summary of income/expenses.

- **Query Params**: `?period=today|week|month|year`

### `PUT /transactions/:id`

_(Requires Auth)_
Partially upates a transaction top-level attributes.

### `DELETE /transactions/:id`

_(Requires Auth)_
Soft-deletes a transaction.

---

## 🧾 Receipt Endpoints

### `POST /transactions/:id/receipt`

_(Requires Auth)_
Upload a receipt for a transaction. Max 5MB.

- **Body**: `multipart/form-data` with key `receipt` containing the file.

### `GET /transactions/:id/receipt`

_(Requires Auth)_
Proxies the requested receipt from the private R2 bucket to the client securely. Client must provide `Authorization` header.

---

## 🤖 AI Insights Endpoints

### `GET /insights/monthly`

_(Requires Auth)_
Uses Cloudflare AI Llama 3 to analyze the user's monthly transactions and provide a short, localized financial summary context in Indonesian.

- **Query Params**: `?month=1&year=2024&force_refresh=false`
