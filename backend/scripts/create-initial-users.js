/**
 * Создание начальных пользователей при запуске.
 * Вызывается из database.js после миграций.
 * Существующие пользователи не трогаются; недостающие из списка создаются.
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../database');

async function createInitialUsers() {
  try {
    console.log('🔄 Проверка начальных пользователей...');

    // Список пользователей (point_id: 1 = Червенский, 2 = Валерианова, 3 = Сеница)
    const users = [
      { username: 'chervenskiy', password: '4506', role: 'user', pointId: 1 },
      { username: 'valeryanova', password: '4506', role: 'user', pointId: 2 },
      { username: 'senitsa67', password: '6767', role: 'user', pointId: 3 },
      { username: 'admin', password: '7511', role: 'admin', pointId: 1 }
    ];

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        // Проверяем, существует ли пользователь
        const existing = await pool.query(
          'SELECT id FROM admins WHERE username = $1',
          [user.username]
        );

        if (existing.rows.length > 0) {
          console.log(`⚠️ Пользователь ${user.username} уже существует, пропускаем`);
          skipped++;
          continue;
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // Создаем пользователя (point_id для разделения точек продаж)
        await pool.query(
          `INSERT INTO admins (username, password, role, point_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username) DO NOTHING`,
          [user.username, hashedPassword, user.role, user.pointId ?? null]
        );

        console.log(`✅ Пользователь ${user.username} создан (роль: ${user.role})`);
        created++;
      } catch (error) {
        console.error(`❌ Ошибка при создании пользователя ${user.username}:`, error.message);
      }
    }

    console.log(`✅ Создание пользователей завершено. Создано: ${created}, пропущено: ${skipped}`);
  } catch (error) {
    console.error('❌ Ошибка при создании начальных пользователей:', error.message);
    // Не прерываем запуск сервера, просто логируем ошибку
  }
}

module.exports = { createInitialUsers };
