-- Персональная скидка клиента в процентах (0–100). С GOLD 10% суммируется на заказе (итог ≤ 100%).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;
UPDATE clients SET personal_discount_percent = 0 WHERE personal_discount_percent IS NULL;
