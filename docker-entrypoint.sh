#!/bin/sh
set -e

echo "Running database schema push..."
npx prisma db push --skip-generate 2>&1 || echo "Schema push warning (may already be applied)"

echo "Running database seed..."
npx prisma db seed 2>&1 || echo "Seed warning (may already be applied)"

echo "Starting application..."
exec node server.js
