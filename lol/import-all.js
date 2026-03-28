/**
 * Запуск всех скриптов импорта.
 * Запуск из корня проекта: node lol/import-all.js
 */

const path = require('path');
const { spawn } = require('child_process');

async function runImportScript(scriptPath, scriptName) {
  try {
    console.log(`📥 Запуск импорта: ${scriptName}...`);
    
    const projectRoot = path.join(__dirname, '..');
    const nodeProcess = spawn('node', [scriptPath], {
      stdio: 'pipe',
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
    });

    // Логируем вывод скрипта
    nodeProcess.stdout.on('data', (data) => {
      console.log(`[${scriptName}] ${data.toString().trim()}`);
    });

    nodeProcess.stderr.on('data', (data) => {
      console.error(`[${scriptName}] ${data.toString().trim()}`);
    });

    return new Promise((resolve) => {
      nodeProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Импорт ${scriptName} завершен успешно`);
        } else {
          console.log(`⚠️ Импорт ${scriptName} завершился с кодом ${code} (это может быть нормально, если файлы отсутствуют)`);
        }
        resolve();
      });

      nodeProcess.on('error', (error) => {
        console.error(`❌ Ошибка при запуске ${scriptName}:`, error.message);
        resolve();
      });
    });
  } catch (error) {
    console.error(`❌ Ошибка импорта ${scriptName}:`, error.message);
  }
}

async function runAllImports() {
  try {
    console.log('🔄 Начинаем импорт всех данных...');

    const scriptsDir = __dirname;

    // Пути к скриптам
    const csvScript = path.join(scriptsDir, 'import-csv.js');
    const silverScript = path.join(scriptsDir, 'import-silver.js');
    const goldScript = path.join(scriptsDir, 'import-gold.js');

    // Запускаем импорты последовательно
    await runImportScript(csvScript, 'CSV клиенты');
    await runImportScript(silverScript, 'Silver клиенты');
    await runImportScript(goldScript, 'Gold клиенты');

    console.log('✅ Импорт всех данных завершен');
  } catch (error) {
    console.error('❌ Ошибка при импорте данных:', error.message);
    process.exit(1);
  }
}

runAllImports();
