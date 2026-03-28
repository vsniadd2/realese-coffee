-- Точки продаж и привязка транзакций/пользователей к точкам
-- Категории: флаг "вести учёт графиками"

-- Таблица точек продаж
CREATE TABLE IF NOT EXISTS points (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Точки по умолчанию (id 1 и 2 для совместимости с пользователями)
INSERT INTO points (id, name) VALUES (1, 'Червенский'), (2, 'Валерианова')
ON CONFLICT (id) DO NOTHING;

-- Привязка пользователя к точке (user — одна точка, admin — NULL, видит все)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS point_id INTEGER REFERENCES points(id);
-- Транзакции привязываем к точке продаж
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS point_id INTEGER REFERENCES points(id);

-- У категорий: вести учёт графиками (по этой группе)
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS track_charts BOOLEAN DEFAULT false;
