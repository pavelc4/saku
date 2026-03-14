-- dummy_data.sql
-- Create a dummy user
INSERT INTO users (id, email, password_hash, name, role, is_banned, created_at, updated_at, email_verified)
VALUES (
    'user_dev_01', 
    'dev@example.com', 
    '$2b$10$klzIpULRkrdoWpkMIUNbAe8sZFFu6bMpmJxfDX2MglBUjfAoWw4W2', -- '123456'
    'Dev User', 
    'user', 
    0, 
    CAST(strftime('%s','now') * 1000 AS INTEGER), 
    CAST(strftime('%s','now') * 1000 AS INTEGER), 
    1
) ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash;

-- Create Categories (System defaults usually have user_id=NULL, but we'll add user categories)
INSERT INTO categories (id, user_id, name, icon, color, type, created_at, updated_at)
VALUES 
    ('cat_01', 'user_dev_01', 'Makanan & Minuman', '🍔', '#F87171', 'expense', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('cat_02', 'user_dev_01', 'Transportasi', '🚗', '#60A5FA', 'expense', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('cat_03', 'user_dev_01', 'Gaji & Pendapatan', '💰', '#34D399', 'income', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('cat_04', 'user_dev_01', 'Hiburan', '🎬', '#A78BFA', 'expense', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('cat_05', 'user_dev_01', 'Freelance', '💻', '#FBBF24', 'income', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('cat_06', 'user_dev_01', 'Belanja', '🛍️', '#F472B6', 'expense', CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER))
ON CONFLICT(id) DO NOTHING;

-- Create Transactions
-- txn 1
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, created_at, updated_at)
VALUES (
    'txn_001', 'user_dev_01', 'cat_01', 150000, 'expense', 
    CAST(strftime('%s','now', '-2 hours') * 1000 AS INTEGER), 
    'Makan siang bareng teman kantor', 'manual',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 1 items
INSERT INTO transaction_items (id, transaction_id, name, price, quantity, created_at)
VALUES 
    ('item_001', 'txn_001', 'Nasi Goreng Spesial', 50000, 2, CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('item_002', 'txn_001', 'Es Teh Manis', 25000, 2, CAST(strftime('%s','now') * 1000 AS INTEGER))
ON CONFLICT(id) DO NOTHING;

-- txn 2
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, created_at, updated_at)
VALUES (
    'txn_002', 'user_dev_01', 'cat_03', 8500000, 'income', 
    CAST(strftime('%s','now', '-3 days') * 1000 AS INTEGER), 
    'Gaji Bulan Ini', 'manual',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 3
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, created_at, updated_at)
VALUES (
    'txn_003', 'user_dev_01', 'cat_02', 50000, 'expense', 
    CAST(strftime('%s','now', '-1 days', '-5 hours') * 1000 AS INTEGER), 
    'Isi bensin motor (Pertalite)', 'manual',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 3 items
INSERT INTO transaction_items (id, transaction_id, name, price, quantity, created_at)
VALUES 
    ('item_003', 'txn_003', 'Pertalite', 10000, 5, CAST(strftime('%s','now') * 1000 AS INTEGER))
ON CONFLICT(id) DO NOTHING;

-- txn 4
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, receipt_url, created_at, updated_at)
VALUES (
    'txn_004', 'user_dev_01', 'cat_06', 350000, 'expense', 
    CAST(strftime('%s','now', '-5 days') * 1000 AS INTEGER), 
    'Beli sepatu lari diskon', 'ai_parsed', 'receipts/user123/txn_004_receipt.jpg',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 4 items
INSERT INTO transaction_items (id, transaction_id, name, price, quantity, created_at)
VALUES 
    ('item_004', 'txn_004', 'Sepatu Lari BrandsX', 350000, 1, CAST(strftime('%s','now') * 1000 AS INTEGER))
ON CONFLICT(id) DO NOTHING;

-- txn 5
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, created_at, updated_at)
VALUES (
    'txn_005', 'user_dev_01', 'cat_05', 1500000, 'income', 
    CAST(strftime('%s','now', '-10 days') * 1000 AS INTEGER), 
    'DP Pembuatan Website SAKU', 'manual',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 6
INSERT INTO transactions (id, user_id, category_id, amount, type, date, note, source, created_at, updated_at)
VALUES (
    'txn_006', 'user_dev_01', 'cat_04', 120000, 'expense', 
    CAST(strftime('%s','now', '-7 days') * 1000 AS INTEGER), 
    'Nonton bioskop', 'manual',
    CAST(strftime('%s','now') * 1000 AS INTEGER), CAST(strftime('%s','now') * 1000 AS INTEGER)
) ON CONFLICT(id) DO NOTHING;

-- txn 6 items
INSERT INTO transaction_items (id, transaction_id, name, price, quantity, created_at)
VALUES 
    ('item_005', 'txn_006', 'Tiket Nonton', 50000, 2, CAST(strftime('%s','now') * 1000 AS INTEGER)),
    ('item_006', 'txn_006', 'Popcorn Caramel', 20000, 1, CAST(strftime('%s','now') * 1000 AS INTEGER))
ON CONFLICT(id) DO NOTHING;

