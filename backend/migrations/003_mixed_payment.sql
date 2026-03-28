-- Смешанная оплата: часть наличными, часть картой
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash_part DECIMAL(10, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_part DECIMAL(10, 2);
