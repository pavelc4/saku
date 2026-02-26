-- Migration: Add POS enhancements (product_categories, pos_sessions, and transaction updates)

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_product_categories_user_id ON product_categories (user_id);

-- System default product categories
INSERT OR IGNORE INTO product_categories (id, user_id, name, color, created_at, updated_at) VALUES
    ('01HZDEFPCAT0000000000001', NULL, 'Makanan', '#F97316', 0, 0),
    ('01HZDEFPCAT0000000000002', NULL, 'Minuman', '#3B82F6', 0, 0),
    ('01HZDEFPCAT0000000000003', NULL, 'Sembako', '#22C55E', 0, 0),
    ('01HZDEFPCAT0000000000004', NULL, 'Elektronik', '#8B5CF6', 0, 0),
    ('01HZDEFPCAT0000000000005', NULL, 'Pakaian', '#EC4899', 0, 0),
    ('01HZDEFPCAT0000000000006', NULL, 'Kesehatan', '#14B8A6', 0, 0),
    ('01HZDEFPCAT0000000000007', NULL, 'Rumah Tangga', '#F59E0B', 0, 0),
    ('01HZDEFPCAT0000000000008', NULL, 'Lainnya', '#6B7280', 0, 0);

-- Update products table to add product_category_id, photo_url, and stock
ALTER TABLE products ADD COLUMN product_category_id TEXT REFERENCES product_categories (id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN photo_url TEXT;
ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (product_category_id);
CREATE INDEX IF NOT EXISTS idx_products_user_active ON products (user_id, is_active);

-- Create pos_sessions table
CREATE TABLE IF NOT EXISTS pos_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    total_omzet INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_user_id ON pos_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_open ON pos_sessions (user_id, closed_at);

-- Add new columns to transactions table
ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'qris'));
ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed'));
ALTER TABLE transactions ADD COLUMN edit_reason TEXT;
ALTER TABLE transactions ADD COLUMN pos_session_id TEXT REFERENCES pos_sessions (id) ON DELETE SET NULL;

-- Add new indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions (user_id, source);
CREATE INDEX IF NOT EXISTS idx_transactions_pos_session ON transactions (pos_session_id);
