# Deploying SAKU to Cloudflare

This guide explains how to deploy the SAKU Backend to your own Cloudflare account. SAKU is built on Cloudflare Workers and utilizes D1 (SQL Database), KV (Key-Value Store), R2 (Object Storage), and Workers AI.

## Prerequisites

1. A [Cloudflare](https://dash.cloudflare.com/sign-up) account.
2. [Bun](https://bun.sh/) installed as your primary runtime.
3. Wrangler CLI authenticated with your Cloudflare account:
   ```bash
   bunx wrangler login
   ```

## Step 1: Create Cloudflare Resources

You need to provision the necessary Cloudflare resources for the production environment.

### 1. D1 Database

Create the production database:

```bash
bunx wrangler d1 create saku-db
```

_Note the `database_name` and `database_id` outputted by this command. You will need to update them in your `wrangler.jsonc` file._

### 2. KV Namespaces

Create three KV namespaces for production:

```bash
bunx wrangler kv:namespace create saku_sessions
bunx wrangler kv:namespace create saku_broadcast
bunx wrangler kv:namespace create saku_verify
```

_Note the `id` for each namespace and update your `wrangler.jsonc` file._

### 3. R2 Bucket

Create the bucket to store transaction receipts:

```bash
bunx wrangler r2 bucket create saku-receipts
```

## Step 2: Configure `wrangler.jsonc`

Open `wrangler.jsonc` in the root directory and update the `id` fields under the respective binding sections (`kv_namespaces`, `d1_databases`) with the IDs you generated in Step 1.

Example:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "saku-db",
    "database_id": "YOUR_D1_DATABASE_ID_HERE"
  }
]
```

## Step 3: Apply Database Migrations (Production)

Apply the database schema to your remote production D1 database:

```bash
bunx wrangler d1 migrations apply saku-db --remote
```

## Step 4: Set Production Environment Variables (Secrets)

For production, sensitive values must be stored as encrypted secrets rather than in a `.dev.vars` file. Run the following commands and paste the respective values when prompted:

```bash
bunx wrangler secret put APP_ENV            # Value: production
bunx wrangler secret put APP_URL            # Value: https://[your-worker-url].workers.dev Atau domain custom
bunx wrangler secret put CORS_ORIGIN        # Value: https://your-frontend-domain.com
bunx wrangler secret put RESEND_API_KEY     # Value: re_xxxxxxx
bunx wrangler secret put GOOGLE_CLIENT_ID   # Value: xxx.apps.googleusercontent.com
bunx wrangler secret put GOOGLE_CLIENT_SECRET # Value: GOCSPX-xxxxxx
bunx wrangler secret put GITHUB_CLIENT_ID   # Value: Iv1.xxxxxx
bunx wrangler secret put GITHUB_CLIENT_SECRET # Value: xxxxxx
```

## Step 5: Deploy the Worker

Finally, publish the worker to Cloudflare's global network:

```bash
bun run deploy
```

Upon successful deployment, Wrangler will provide you with the production URL of your Worker (e.g., `https://saku.your-subdomain.workers.dev`).

## Step 6: Update OAuth Callbacks

Don't forget to update your Google Cloud Console and GitHub Developer Settings to add your new production Worker URL to the list of authorized callback URIs.

- Google: `https://saku.your-subdomain.workers.dev/auth/google/callback`
- GitHub: `https://saku.your-subdomain.workers.dev/auth/github/callback`
