#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy 2>&1 || echo "Migration warning (may already be applied)"

echo "Running database seed..."
npx prisma db seed 2>&1 || echo "Seed warning (may already be applied)"

echo "Starting application..."
exec node server.js
