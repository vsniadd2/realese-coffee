-- Баланс на счёте клиента (зачисления), BYN
ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;
UPDATE clients SET account_balance = 0 WHERE account_balance IS NULL;
