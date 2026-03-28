-- Админ должен идти в учёт точки Червенский (point_id = 1).
-- Устанавливаем point_id для админов, у которых он не задан.
UPDATE admins
SET point_id = 1
WHERE role = 'admin' AND (point_id IS NULL OR point_id = 0);
