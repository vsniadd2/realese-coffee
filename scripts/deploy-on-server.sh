#!/bin/bash
# Обновление приложения на сервере после git push
# Запускать на сервере из корня проекта: bash scripts/deploy-on-server.sh
#
# БД хранится в именованном volume postgres_data — сохраняется при git pull
# и пересборке. Удаляется ТОЛЬКО при: docker compose down -v

set -e
echo "→ 1. Обновление кода из Git..."
git pull origin main 2>/dev/null || git pull

echo "→ 2. Пересборка и перезапуск контейнеров..."
echo "   (данные БД в volume сохраняются)"
docker compose up -d --build

echo "→ 3. Готово. Статус:"
docker compose ps

echo ""
echo "Миграции БД применяются при каждом старте backend. Логи: docker compose logs backend"
echo ""
echo "ВАЖНО: Никогда не используйте 'docker compose down -v' — флаг -v удалит данные БД!"
