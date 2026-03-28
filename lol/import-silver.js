/**
 * Импорт клиентов SILVER из Excel (silver 5.xlsx) в БД.
 * Ожидаемые колонки: Имя, Фамилия, Отчество (или одна ФИО), Идентификаторы.
 * Все импортируемые клиенты получают status = standart, total_spent = 350.
 * Запуск из корня проекта: node lol/import-silver.js
 */

const path = require('path');
const XLSX = require('xlsx');
const { pool, initDatabase } = require('../backend/database');

const EXCEL_PATH = path.join(__dirname, 'silver 5.xlsx');

function normalizeHeader(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.toString().trim().toLowerCase();
}

/** Разбить ФИО из одной ячейки: "Фамилия Имя Отчество" или "Имя Фамилия Отчество" */
function parseFIO(fio) {
  const s = (fio || '').toString().trim().replace(/\s+/g, ' ').split(' ');
  if (s.length === 0 || (s.length === 1 && !s[0])) {
    return { firstName: 'Без имени', lastName: 'Без фамилии', middleName: null };
  }
  if (s.length === 1) return { firstName: s[0], lastName: 'Без фамилии', middleName: null };
  if (s.length === 2) return { firstName: s[0], lastName: s[1], middleName: null };
  // 3+ слов: считаем Фамилия Имя Отчество
  return {
    lastName: s[0],
    firstName: s[1],
    middleName: s.slice(2).join(' ') || null
  };
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

/** Поиск колонки по вхождению подстроки в заголовок */
function findColumnIndexByPartial(headers, searchTerms) {
  const normalized = headers.map(normalizeHeader);
  for (const term of searchTerms) {
    const t = normalizeHeader(term);
    const i = normalized.findIndex(h => h && h.includes(t));
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

  let workbook;
  try {
    workbook = XLSX.readFile(EXCEL_PATH);
  } catch (e) {
    console.error('Не удалось прочитать файл:', EXCEL_PATH, e.message);
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    console.log('В листе нет данных (нужна строка заголовков и хотя бы одна строка данных).');
    process.exit(0);
  }

  let headerRowIndex = 0;
  let headers = rows[0].map(h => (h != null ? String(h) : ''));

  function detectColumns(hdr) {
    let iFirst = findColumnIndex(hdr, ['Имя', 'имя']);
    let iLast = findColumnIndex(hdr, ['Фамилия', 'фамилия']);
    let iMiddle = findColumnIndex(hdr, ['Отчество', 'отчество']);
    let iFIO = findColumnIndex(hdr, ['ФИО', 'фои', 'Фои']);
    let iIdent = findColumnIndex(hdr, ['Идентификаторы', 'идентификаторы']);
    if (iFirst < 0) iFirst = findColumnIndexByPartial(hdr, ['имя']);
    if (iLast < 0) iLast = findColumnIndexByPartial(hdr, ['фамилия']);
    if (iMiddle < 0) iMiddle = findColumnIndexByPartial(hdr, ['отчество']);
    if (iFIO < 0) iFIO = findColumnIndexByPartial(hdr, ['фои', 'фио']);
    if (iIdent < 0) iIdent = findColumnIndexByPartial(hdr, ['идентификатор']);
    const hasFIO = (iFirst >= 0 && iLast >= 0) || iFIO >= 0;
    return { hasFIO, hasIdent: iIdent >= 0, idxFirstName: iFirst, idxLastName: iLast, idxMiddleName: iMiddle, idxFIO: iFIO, idxIdentifiers: iIdent };
  }

  let detected = detectColumns(headers);
  if (!detected.hasFIO || !detected.hasIdent) {
    for (let r = 1; r < Math.min(rows.length, 10); r++) {
      headers = rows[r].map(h => (h != null ? String(h) : ''));
      detected = detectColumns(headers);
      if (detected.hasFIO && detected.hasIdent) {
        headerRowIndex = r;
        break;
      }
    }
  }

  const idxFirstName = detected.idxFirstName;
  const idxLastName = detected.idxLastName;
  const idxMiddleName = detected.idxMiddleName;
  const idxFIO = detected.idxFIO;
  const idxIdentifiers = detected.idxIdentifiers;
  const hasSeparateFIO = idxFirstName >= 0 && idxLastName >= 0;
  const hasFIO = idxFIO >= 0;

  if (!hasSeparateFIO && !hasFIO) {
    console.error('Не найдены колонки для ФИО: нужны либо Имя, Фамилия, Отчество, либо колонка ФИО.');
    console.error('Найденные заголовки (строка ' + headerRowIndex + '):', JSON.stringify(headers));
    process.exit(1);
  }
  if (idxIdentifiers < 0) {
    console.error('Не найдена колонка "Идентификаторы".');
    console.error('Найденные заголовки (строка ' + headerRowIndex + '):', JSON.stringify(headers));
    process.exit(1);
  }

  const dataStartRow = headerRowIndex + 1;

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    let firstName, lastName, middleName;
    if (hasSeparateFIO) {
      firstName = (row[idxFirstName] != null ? String(row[idxFirstName]) : '').trim() || 'Без имени';
      lastName = (row[idxLastName] != null ? String(row[idxLastName]) : '').trim() || 'Без фамилии';
      middleName = (row[idxMiddleName] != null ? String(row[idxMiddleName]) : '').trim() || null;
    } else {
      const fio = row[idxFIO] != null ? String(row[idxFIO]) : '';
      const parsed = parseFIO(fio);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
      middleName = parsed.middleName;
    }

    let identifiersRaw = row[idxIdentifiers] != null ? String(row[idxIdentifiers]) : '';
    identifiersRaw = identifiersRaw.trim();
    // Берём все идентификаторы как есть (формат "0196; +375296211257; +375296211257" или один)
    const clientId = identifiersRaw.slice(0, 255);
    if (!clientId) {
      skipped++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO clients (first_name, last_name, middle_name, client_id, status, total_spent)
         VALUES ($1, $2, $3, $4, 'standart', 350)
         ON CONFLICT (client_id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           middle_name = EXCLUDED.middle_name,
           status = 'standart',
           total_spent = 350,
           updated_at = CURRENT_TIMESTAMP`,
        [firstName, lastName, middleName, clientId]
      );
      inserted++;
    } catch (err) {
      console.error('Строка', i + 1, err.message || err.code || String(err));
      errors++;
    }
  }

  console.log('Готово. Добавлено/обновлено:', inserted, ', пропущено (нет идентификаторов):', skipped, ', ошибок:', errors);
  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
