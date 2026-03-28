/**
 * Импорт стандартных клиентов из CSV в БД.
 * Файл: QvdC+0LLQvgoJMQnQk9C+0LLRiNCwCdCh0LXRgNCz0LXQuQkJ0JrQu9C40LXQvd.csv
 * Формат: № | Фамилия | Имя | Отчество | Группа клиента | ... | Идентификаторы | ...
 * Все импортируемые клиенты получают status = standart, total_spent = 0.
 * Если клиент с таким client_id уже существует — пропускаем (НЕ обновляем).
 * Запуск из корня проекта: node lol/import-csv.js
 */

const path = require('path');
const fs = require('fs');
const { pool, initDatabase } = require('../backend/database');

const CSV_PATH = path.join(__dirname, 'QvdC+0LLQvgoJMQnQk9C+0LLRiNCwCdCh0LXRgNCz0LXQuQkJ0JrQu9C40LXQvd.csv');

function parseCSVLine(line) {
  // Простой парсер CSV с разделителем табуляция
  return line.split('\t').map(cell => (cell || '').trim());
}

function normalizeHeader(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.toString().trim().toLowerCase();
}

function findColumnIndex(headers, names) {
  const normalized = headers.map(normalizeHeader);
  for (const name of names) {
    const n = normalizeHeader(name);
    const i = normalized.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

async function run() {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      console.error('Не удалось подключиться к PostgreSQL (localhost:5432). Запустите БД, например: docker compose up -d');
    } else {
      console.error('Ошибка БД:', e.message);
    }
    process.exit(1);
  }

  console.log('Инициализация БД (создание таблиц при необходимости)...');
  await initDatabase();

  let csvContent;
  try {
    csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  } catch (e) {
    console.error('Не удалось прочитать файл:', CSV_PATH, e.message);
    process.exit(1);
  }

  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 3) {
    console.log('В файле нет данных (нужна строка заголовков и хотя бы одна строка данных).');
    process.exit(0);
  }

  // Первые строки могут быть заголовком отчёта, ищем строку с колонками
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = parseCSVLine(lines[i]);
    const normalized = cells.map(normalizeHeader);
    
    // Ищем строку, содержащую "фамилия", "имя", "идентификаторы"
    if (normalized.some(h => h.includes('фамилия')) && 
        normalized.some(h => h.includes('имя')) &&
        normalized.some(h => h.includes('идентификатор'))) {
      headerRowIndex = i;
      headers = cells;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('Не найдена строка с заголовками (должны быть колонки: Фамилия, Имя, Идентификаторы).');
    process.exit(1);
  }

  const idxLastName = findColumnIndex(headers, ['Фамилия', 'фамилия']);
  const idxFirstName = findColumnIndex(headers, ['Имя', 'имя']);
  const idxMiddleName = findColumnIndex(headers, ['Отчество', 'отчество']);
  const idxIdentifiers = findColumnIndex(headers, ['Идентификаторы', 'идентификаторы']);

  if (idxLastName < 0) {
    console.error('Не найдена колонка "Фамилия".');
    console.error('Найденные заголовки:', JSON.stringify(headers));
    process.exit(1);
  }
  if (idxFirstName < 0) {
    console.error('Не найдена колонка "Имя".');
    console.error('Найденные заголовки:', JSON.stringify(headers));
    process.exit(1);
  }
  if (idxIdentifiers < 0) {
    console.error('Не найдена колонка "Идентификаторы".');
    console.error('Найденные заголовки:', JSON.stringify(headers));
    process.exit(1);
  }

  console.log(`Найдена строка заголовков: ${headerRowIndex + 1}`);
  console.log(`Колонки: Фамилия (${idxLastName}), Имя (${idxFirstName}), Отчество (${idxMiddleName}), Идентификаторы (${idxIdentifiers})`);

  const dataStartRow = headerRowIndex + 1;

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = dataStartRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseCSVLine(line);
    if (cells.length < Math.max(idxLastName, idxFirstName, idxIdentifiers) + 1) {
      // Недостаточно колонок в строке
      skipped++;
      continue;
    }

    const lastName = (cells[idxLastName] || '').trim() || 'Без фамилии';
    const firstName = (cells[idxFirstName] || '').trim() || 'Без имени';
    const middleName = idxMiddleName >= 0 ? ((cells[idxMiddleName] || '').trim() || null) : null;
    
    let identifiersRaw = (cells[idxIdentifiers] || '').trim();
    // Берём все идентификаторы как есть
    const clientId = identifiersRaw.slice(0, 255);
    
    if (!clientId) {
      skipped++;
      continue;
    }

    try {
      // Проверяем, существует ли клиент с таким client_id
      const existing = await pool.query(
        'SELECT id FROM clients WHERE client_id = $1',
        [clientId]
      );

      if (existing.rows.length > 0) {
        // Клиент уже существует — пропускаем
        skipped++;
        continue;
      }

      // Клиента нет — добавляем
      await pool.query(
        `INSERT INTO clients (first_name, last_name, middle_name, client_id, status, total_spent)
         VALUES ($1, $2, $3, $4, 'standart', 0)`,
        [firstName, lastName, middleName, clientId]
      );
      inserted++;
    } catch (err) {
      console.error('Строка', i + 1, '(client_id:', clientId + '):', err.message || err.code || String(err));
      errors++;
    }
  }

  console.log('Готово. Добавлено:', inserted, ', пропущено (дубликаты/нет идентификаторов):', skipped, ', ошибок:', errors);
  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
