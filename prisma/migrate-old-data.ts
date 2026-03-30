/**
 * Migra Category, SubCategory e Product do banco antigo (schema PascalCase)
 * para o banco novo (Prisma). IDs antigos não são preservados; relacionamentos
 * são mantidos via mapas oldId -> newId.
 *
 * Uso:
 *   OLD_DATABASE_URL="postgresql://..." npx ts-node prisma/migrate-old-data.ts
 *
 * Requer DATABASE_URL apontando para o banco novo (Prisma).
 *
 * RDS/AWS costuma exigir TLS: para o banco antigo, SSL é ligado automaticamente se
 * a URL contiver rds.amazonaws.com (ou use ?sslmode=require na URL).
 * Para desligar: OLD_DATABASE_SSL=disable
 * Certificado não confiável pelo Node: OLD_DATABASE_SSL=no-verify
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { oldDatabasePgConfig } from './old-pg-config';

const prisma = new PrismaClient();

/** Unidade no final do nome: 500g, 1L, 1,5L, 200ml, 1kg, etc. */
const UNIT_REGEX =
  /(\d+[.,]?\d*\s*(?:kg|g|mg|l|ml|un|pç|pc|und|lt|cx|pct|sache|sachê))\s*$/i;

const DEFAULT_BRAND = 'Sem marca';
const DEFAULT_UNIT = 'un';

function clamp(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max);
}

/**
 * Extrai unit do final do nome e tenta inferir brand do restante.
 */
export function extractBrandAndUnitFromName(rawName: string): {
  name: string;
  brand: string;
  unit: string;
  usedDefaultBrand: boolean;
  usedDefaultUnit: boolean;
} {
  const trimmed = rawName.trim();
  const match = trimmed.match(UNIT_REGEX);
  let unit = DEFAULT_UNIT;
  let usedDefaultUnit = true;
  let nameWithoutUnit = trimmed;

  if (match && match[1]) {
    unit = match[1].replace(/\s+/g, ' ').trim();
    nameWithoutUnit = trimmed.slice(0, match.index).trim();
    usedDefaultUnit = false;
  }

  const tokens = nameWithoutUnit.split(/\s+/).filter(Boolean);
  let brand = DEFAULT_BRAND;
  let usedDefaultBrand = true;

  if (tokens.length >= 3) {
    brand = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
    usedDefaultBrand = false;
  } else if (tokens.length === 2) {
    brand = tokens[tokens.length - 1]!;
    usedDefaultBrand = false;
  }

  return {
    name: clamp(trimmed, 300),
    brand: clamp(brand, 200),
    unit: clamp(unit, 50),
    usedDefaultBrand,
    usedDefaultUnit,
  };
}

function normalizeBarcode(barcode: string | null): {
  value: string;
  generated: boolean;
} {
  if (barcode == null || barcode.trim() === '') {
    const id = randomUUID().replace(/-/g, '').slice(0, 12);
    return { value: clamp(`NOBARCODE-${id}`, 50), generated: true };
  }
  return { value: clamp(barcode.trim(), 50), generated: false };
}

async function main() {
  const oldUrl = process.env.OLD_DATABASE_URL;
  if (!oldUrl) {
    console.error(
      'Defina OLD_DATABASE_URL com a connection string do banco antigo.',
    );
    process.exit(1);
  }

  const oldClient = new Client(oldDatabasePgConfig(oldUrl));
  await oldClient.connect();

  try {
    const categoryMap = new Map<number, number>();
    let categoriesCreated = 0;
    let categoriesReused = 0;

    const { rows: oldCategories } = await oldClient.query<{
      id: number;
      name: string;
    }>(`SELECT id, name FROM "Category" ORDER BY id`);

    for (const row of oldCategories) {
      const name = clamp(row.name.trim(), 200);
      let existing = await prisma.category.findFirst({
        where: { name },
      });

      if (!existing) {
        existing = await prisma.category.create({
          data: { name },
        });
        categoriesCreated++;
      } else {
        categoriesReused++;
      }

      categoryMap.set(row.id, existing.id);
    }

    console.log(
      `Categorias: ${oldCategories.length} processadas (${categoriesCreated} criadas, ${categoriesReused} reutilizadas).`,
    );

    const subCategoryMap = new Map<number, number>();
    let subCreated = 0;
    let subReused = 0;

    const { rows: oldSubs } = await oldClient.query<{
      id: number;
      name: string;
      categoryId: number;
    }>(`SELECT id, name, "categoryId" AS "categoryId" FROM "SubCategory" ORDER BY id`);

    for (const row of oldSubs) {
      const newCatId = categoryMap.get(row.categoryId);
      if (newCatId == null) {
        console.warn(
          `SubCategory id=${row.id}: categoryId=${row.categoryId} não mapeado; ignorando.`,
        );
        continue;
      }

      const name = clamp(row.name.trim(), 200);
      let existing = await prisma.subCategory.findFirst({
        where: { name, categoryId: newCatId },
      });

      if (!existing) {
        existing = await prisma.subCategory.create({
          data: {
            name,
            categoryId: newCatId,
          },
        });
        subCreated++;
      } else {
        subReused++;
      }

      subCategoryMap.set(row.id, existing.id);
    }

    console.log(
      `Subcategorias: ${oldSubs.length} lidas (${subCreated} criadas, ${subReused} reutilizadas).`,
    );

    const { rows: oldProducts } = await oldClient.query<{
      id: number;
      barcode: string | null;
      name: string;
      imageUrl: string | null;
      categoryId: number | null;
      subCategoryId: number | null;
    }>(
      `SELECT id, barcode, name, "imageUrl" AS "imageUrl", "categoryId" AS "categoryId", "subCategoryId" AS "subCategoryId" FROM "Product" ORDER BY id`,
    );

    const seenBarcodes = new Set<string>();
    let productsInserted = 0;
    let productsWithBarcodeDisambiguation = 0;
    let generatedBarcodes = 0;
    let defaultBrandCount = 0;
    let defaultUnitCount = 0;

    for (const row of oldProducts) {
      const { value: barcodeRaw, generated } = normalizeBarcode(row.barcode);
      if (generated) generatedBarcodes++;

      let barcode = barcodeRaw;
      if (seenBarcodes.has(barcode)) {
        let suffix = 0;
        do {
          suffix++;
          const base = barcodeRaw.slice(
            0,
            Math.max(0, 50 - String(suffix).length - 1),
          );
          barcode = clamp(`${base}-${suffix}`, 50);
        } while (seenBarcodes.has(barcode));
        productsWithBarcodeDisambiguation++;
      }
      seenBarcodes.add(barcode);

      const extracted = extractBrandAndUnitFromName(row.name);
      if (extracted.usedDefaultBrand) defaultBrandCount++;
      if (extracted.usedDefaultUnit) defaultUnitCount++;

      const newCategoryId =
        row.categoryId != null ? categoryMap.get(row.categoryId) ?? null : null;
      const newSubCategoryId =
        row.subCategoryId != null
          ? subCategoryMap.get(row.subCategoryId) ?? null
          : null;

      if (row.categoryId != null && newCategoryId == null) {
        console.warn(
          `Product id=${row.id}: categoryId=${row.categoryId} sem mapeamento; category_id ficará null.`,
        );
      }
      if (row.subCategoryId != null && newSubCategoryId == null) {
        console.warn(
          `Product id=${row.id}: subCategoryId=${row.subCategoryId} sem mapeamento; sub_category_id ficará null.`,
        );
      }

      await prisma.product.create({
        data: {
          name: extracted.name,
          brand: extracted.brand,
          barcode,
          unit: extracted.unit,
          imageUrl: row.imageUrl?.trim() || null,
          categoryId: newCategoryId,
          subCategoryId: newSubCategoryId,
        },
      });
      productsInserted++;
    }

    console.log(`Produtos inseridos: ${productsInserted}`);
    console.log(`Barcodes gerados (sem barcode no antigo): ${generatedBarcodes}`);
    console.log(
      `Produtos com barcode ajustado por duplicidade: ${productsWithBarcodeDisambiguation}`,
    );
    console.log(`Produtos com brand padrão ("${DEFAULT_BRAND}"): ${defaultBrandCount}`);
    console.log(`Produtos com unit padrão ("${DEFAULT_UNIT}"): ${defaultUnitCount}`);
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
