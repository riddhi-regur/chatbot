#!/bin/sh
echo "Running database migrations..."
npx prisma db push --skip-generate
echo "Starting server..."
node src/index.js
