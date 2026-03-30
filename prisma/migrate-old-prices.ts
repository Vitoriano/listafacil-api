/**
 * Lê preços do banco antigo (tabela "Product".price) e cria registros em `prices`
 * no banco novo (Prisma), casando produto por barcode.
 *
 * Uso:
 *   OLD_DATABASE_URL=... PRICE_IMPORT_USER_ID=<uuid de um user existente> npx ts-node prisma/migrate-old-prices.ts
 *
 * Opcional:
 *   PRICE_IMPORT_STORE_ID — default: loja indicada abaixo
 *
 * Requer DATABASE_URL (banco novo). Mesmas regras SSL que migrate-old-data (OLD_DATABASE_SSL, rds.amazonaws.com).
 */

import path from 'node:path';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { oldDatabasePgConfig } from './old-pg-config';

const DEFAULT_STORE_ID = 'e2d8c9b3-42f2-4e94-ac07-834e09af370b';

function clampBarcode(barcode: string): string {
  const t = barcode.trim();
  return t.length <= 50 ? t : t.slice(0, 50);
}

async function main() {
  const oldUrl = process.env.OLD_DATABASE_URL;
  if (!oldUrl) {
    console.error(
      'Defina OLD_DATABASE_URL com a connection string do banco antigo.',
    );
    process.exit(1);
  }

  const userId = process.env.PRICE_IMPORT_USER_ID?.trim();
  if (!userId) {
    console.error(
      'Defina PRICE_IMPORT_USER_ID com o UUID de um usuário existente no banco novo (autor do preço).',
    );
    process.exit(1);
  }

  const storeId =
    process.env.PRICE_IMPORT_STORE_ID?.trim() || DEFAULT_STORE_ID;

  const prisma = new PrismaClient();

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    console.error(`Loja não encontrada (id=${storeId}).`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`Usuário não encontrado (PRICE_IMPORT_USER_ID=${userId}).`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const oldClient = new Client(oldDatabasePgConfig(oldUrl));
  await oldClient.connect();

  let inserted = 0;
  let skippedNoProduct = 0;
  let skippedInvalid = 0;

  try {
    const { rows } = await oldClient.query<{
      barcode: string;
      price: number;
    }>(
      `SELECT barcode, price FROM "Product" WHERE barcode IS NOT NULL AND trim(barcode) <> '' ORDER BY id`,
    );

    console.log(
      `Loja: ${store.name} (${storeId})\nUsuário preço: ${user.email}\nLinhas no banco antigo: ${rows.length}`,
    );

    for (const row of rows) {
      const barcode = clampBarcode(row.barcode);
      if (!barcode) {
        skippedInvalid++;
        continue;
      }

      const priceNum = Number(row.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        skippedInvalid++;
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { barcode },
      });

      if (!product) {
        skippedNoProduct++;
        continue;
      }

      const price = new Prisma.Decimal(priceNum.toFixed(2));

      await prisma.price.create({
        data: {
          productId: product.id,
          storeId,
          userId,
          price,
        },
      });
      inserted++;
    }

    console.log(`Preços criados: ${inserted}`);
    console.log(`Ignorados (produto não encontrado por barcode): ${skippedNoProduct}`);
    console.log(`Ignorados (barcode/preço inválido): ${skippedInvalid}`);
  } finally {
    await oldClient.end();
    await prisma.$disconnect();
  }
}

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(__filename);
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
