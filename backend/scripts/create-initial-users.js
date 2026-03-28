/**
 * Создание начальных пользователей при первом запуске.
 * Этот скрипт вызывается автоматически из database.js при инициализации БД,
 * если таблица admins пустая (первый запуск).
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../database');

async function createInitialUsers() {
  try {
    // Проверяем, есть ли уже пользователи в БД
    const result = await pool.query('SELECT COUNT(*) as count FROM admins');
    const adminCount = parseInt(result.rows[0].count);

    if (adminCount > 0) {
      console.log('ℹ️ В БД уже есть пользователи, пропускаем создание начальных пользователей');
      return;
    }

    console.log('🔄 Первый запуск: создание начальных пользователей...');

    // Список пользователей для создания (point_id: 1 = Червенский, 2 = Валерианова, null = админ, все точки)
    const users = [
      { username: 'chervenskiy', password: '4506', role: 'user', pointId: 1 },
      { username: 'valeryanova', password: '4506', role: 'user', pointId: 2 },
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

