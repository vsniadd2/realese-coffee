-- Начальная схема БД. Все команды идемпотентны (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- При первом запуске создаёт таблицы и колонки; при повторном — не ломает существующую БД.

-- Таблица для учёта применённых миграций (создаётся и в database.js до runMigrations)
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Админы (пользователи системы)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Клиенты
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  client_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'standart',
  total_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Транзакции (client_id NULL = анонимный заказ)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(5, 2) DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) DEFAULT 'sale';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS replacement_of_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_user VARCHAR(255);

-- Делаем client_id допускающим NULL (анонимные заказы)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'client_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE transactions ALTER COLUMN client_id DROP NOT NULL;
  END IF;
END $$;

-- Товары в транзакции
CREATE TABLE IF NOT EXISTS transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Категории товаров
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL,
  icon VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Подкатегории
CREATE TABLE IF NOT EXISTS product_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES product_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Товары
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  subcategory_id INTEGER REFERENCES product_subcategories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  image_data TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags VARCHAR(255) DEFAULT '';

-- Миграция image_url -> image_data (если была старая колонка)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_data') THEN
    ALTER TABLE products RENAME COLUMN image_url TO image_data;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url') THEN
    UPDATE products SET image_data = image_url WHERE image_data IS NULL AND image_url IS NOT NULL;
    ALTER TABLE products DROP COLUMN IF EXISTS image_url;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_data') THEN
    ALTER TABLE products ADD COLUMN image_data TEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Тикеты на удаление истории покупок
CREATE TABLE IF NOT EXISTS deletion_tickets (
  id SERIAL PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_deletion_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  executed_at TIMESTAMP
);

-- client_id в clients допускает NULL (прочерк в интерфейсе)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE clients ALTER COLUMN client_id DROP NOT NULL;
  END IF;
END $$;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_clients_first_name ON clients(first_name);
CREATE INDEX IF NOT EXISTS idx_clients_last_name ON clients(last_name);
CREATE INDEX IF NOT EXISTS idx_clients_middle_name ON clients(middle_name);
CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_name_search ON clients(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_client_created ON transactions(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_deletion_tickets_status ON deletion_tickets(status);
CREATE INDEX IF NOT EXISTS idx_deletion_tickets_scheduled_at ON deletion_tickets(scheduled_deletion_at);
