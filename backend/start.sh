#!/bin/sh

set -e

echo "Initializing database..."
node scripts/init-pgvector.js

echo "Running database migrations..."
npx prisma db push --skip-generate

echo "Checking database..."

if node scripts/check-seed.js
then
    echo "Database empty. Running seed..."
    npm run db:seed
else
    echo "Database already seeded."
fi

echo "Starting server..."
node src/index.js