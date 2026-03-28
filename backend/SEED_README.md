# Импорт продовых данных клиентов

Скрипт `seed-prod.js` импортирует клиентов из CSV файла в БД PostgreSQL.

## Структура CSV

CSV файл должен содержать колонки:
- **Имя** (first_name)
- **Фамилия** (last_name)  
- **Отчество** (middle_name)
- **ID** (client_id) — телефон или номер карты
- **Статус** (status) — STANDART или GOLD
- **Покупки (BYN)** (total_spent) — общая сумма покупок
- **Дата создания** (created_at) — в формате "DD.MM.YYYY, HH:MM"

## Использование на сервере

### 1. Скопировать CSV файл на сервер

```bash
# С локальной машины на сервер
scp clients_74d3ad66-b236-4d84-9bdf-1f4cdc7cb72e.csv root@server-fxzrsp:~/realese-coffee/
```

### 2. Зайти на сервер и запустить импорт

```bash
ssh root@server-fxzrsp
cd ~/realese-coffee

# Запустить импорт через Docker (рекомендуется)
docker compose exec backend node seed-prod.js

# Или запустить напрямую внутри контейнера
docker compose exec backend sh
cd /app
node seed-prod.js
exit
```

### 3. Если БД работает на хосте (не в Docker)

```bash
cd ~/realese-coffee/backend

# Установить переменные окружения (если нужно)
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=admin
export DB_PASSWORD=admin123
export DB_NAME=coffee_crm

# Запустить скрипт
node seed-prod.js
```

## Что делает скрипт

1. **Парсит CSV** — читает файл `clients_74d3ad66-b236-4d84-9bdf-1f4cdc7cb72e.csv` из корня проекта
2. **Проверяет БД** — если уже есть клиенты, даёт 3 секунды на отмену (Ctrl+C)
3. **Удаляет старые данные** — выполняет `TRUNCATE clients CASCADE`
4. **Вставляет клиентов** — 316 записей с сохранением дат и статусов
5. **Показывает статистику** — количество вставленных/пропущенных записей

## Особенности

- **ON CONFLICT** — если `client_id` уже существует, обновляет запись
- **Транзакция** — весь импорт в одной транзакции (ROLLBACK при ошибке)
- **Парсинг дат** — автоматически конвертирует "27.03.2026, 15:47" в `TIMESTAMP`
- **Статусы** — приводит к lower case: `STANDART` → `standart`, `GOLD` → `gold`

## Проверка результата

```sql
-- В psql или через adminer
SELECT status, COUNT(*) FROM clients GROUP BY status;
SELECT COUNT(*) FROM clients;
SELECT * FROM clients ORDER BY created_at DESC LIMIT 10;
```

Или через API:

```bash
curl http://localhost:3000/api/clients?limit=10
```
