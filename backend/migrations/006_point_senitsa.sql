-- Точка продаж Сеница (id = 3)
INSERT INTO points (id, name) VALUES (3, 'Сеница')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('points', 'id'), (SELECT MAX(id) FROM points));
