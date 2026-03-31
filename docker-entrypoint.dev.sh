#!/bin/sh
set -e

echo ">> Generating Prisma client..."
npx prisma generate

echo ">> Running migrations..."
npx prisma migrate deploy

echo ">> Seeding database..."
npx ts-node prisma/seed.ts

echo ">> Starting dev server..."
exec npm run start:dev
