#!/bin/bash
# Бэкап БД перед обновлением. Запускать на сервере из корня проекта.
# Сохраняет дамп в backups/ с датой.

set -e
mkdir -p backups
FILE="backups/coffee_crm_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec -T postgres pg_dump -U admin coffee_crm > "$FILE"
echo "✅ Бэкап сохранён: $FILE"
