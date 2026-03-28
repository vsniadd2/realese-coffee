const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME || 'coffee_crm'
});

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const clients = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    if (fields.length >= 7) {
      const firstName = fields[0] || '';
      const lastName = fields[1] || '';
      const middleName = fields[2] || null;
      const clientId = fields[3] || null;
      const status = (fields[4] || 'STANDART').toLowerCase();
      const totalSpent = parseFloat(fields[5]) || 0;
      const createdAt = parseDateTime(fields[6]);
      
      clients.push({
        firstName,
        lastName,
        middleName,
        clientId,
        status,
        totalSpent,
        createdAt
      });
    }
  }
  
  return clients;
}

function parseDateTime(dateStr) {
  if (!dateStr) return new Date();
  
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return new Date(year, month - 1, day, hour, minute);
  }
  
  return new Date();
}

async function seedDatabase() {
  const csvPath = path.join(__dirname, '..', 'clients_74d3ad66-b236-4d84-9bdf-1f4cdc7cb72e.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV файл не найден: ${csvPath}`);
    console.log('Положите файл clients_74d3ad66-b236-4d84-9bdf-1f4cdc7cb72e.csv в корень проекта');
    process.exit(1);
  }
  
  console.log('Парсинг CSV файла...');
  const clients = parseCSV(csvPath);
  console.log(`Найдено ${clients.length} клиентов`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('\nПроверка существующих клиентов...');
    const existingResult = await client.query('SELECT COUNT(*) as count FROM clients');
    const existingCount = parseInt(existingResult.rows[0].count);
    
    if (existingCount > 0) {
      console.log(`В БД уже есть ${existingCount} клиентов.`);
      console.log('Хотите удалить существующие данные и загрузить заново? (Ctrl+C для отмены)');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('Удаление существующих клиентов...');
      await client.query('TRUNCATE clients CASCADE');
      console.log('Существующие данные удалены.');
    }
    
    console.log('\nВставка клиентов...');
    let inserted = 0;
    let skipped = 0;
    
    for (const c of clients) {
      try {
        await client.query(
          `INSERT INTO clients (first_name, last_name, middle_name, client_id, status, total_spent, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           ON CONFLICT (client_id) DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             middle_name = EXCLUDED.middle_name,
             status = EXCLUDED.status,
             total_spent = EXCLUDED.total_spent,
             updated_at = EXCLUDED.created_at`,
          [c.firstName, c.lastName, c.middleName, c.clientId, c.status, c.totalSpent, c.createdAt]
        );
        inserted++;
        
        if (inserted % 50 === 0) {
          console.log(`  Вставлено ${inserted} из ${clients.length}...`);
        }
      } catch (err) {
        console.warn(`Ошибка при вставке клиента ${c.firstName} ${c.lastName}: ${err.message}`);
        skipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n✓ Импорт завершён!');
    console.log(`  Вставлено: ${inserted}`);
    console.log(`  Пропущено: ${skipped}`);
    
    const finalCount = await client.query('SELECT COUNT(*) as count FROM clients');
    console.log(`  Всего клиентов в БД: ${finalCount.rows[0].count}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка при импорте:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
