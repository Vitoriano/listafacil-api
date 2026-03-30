/**
 * Autoteste da heurística de brand/unit (sem banco).
 * npx ts-node prisma/migrate-old-data.selftest.ts
 */
import assert from 'node:assert/strict';
import { extractBrandAndUnitFromName } from './migrate-old-data';

const r1 = extractBrandAndUnitFromName('Arroz Tio João 5kg');
assert.equal(r1.unit, '5kg');
assert.equal(r1.usedDefaultUnit, false);
assert.equal(r1.name, 'Arroz Tio João 5kg');

const r2 = extractBrandAndUnitFromName('Leite Integral 1L');
assert.equal(r2.unit, '1L');
assert.equal(r2.usedDefaultUnit, false);

const r3 = extractBrandAndUnitFromName('Água');
assert.equal(r3.usedDefaultUnit, true);
assert.equal(r3.unit, 'un');

const r4 = extractBrandAndUnitFromName('Refrigerante 350ml');
assert.equal(r4.unit, '350ml');

console.log('migrate-old-data extract selftest: OK');
