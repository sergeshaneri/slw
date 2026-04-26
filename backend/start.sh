#!/bin/sh
set -e

echo "Running migrations..."
python -m alembic upgrade head

echo "Seeding content..."
python -m app.content.seed

echo "Starting bot..."
exec python -m app.bot.main
