#!/usr/bin/env node
/**
 * reset-rifa-sede2.mjs — Backup completo + reset de la BD productiva para reusar
 * el sistema en la SEGUNDA SEDE del colegio (mismo evento, misma cuenta MercadoPago).
 *
 * Sucesor de setup-rifa-2026.mjs, extendido al schema post-Fase 7 (8 tablas).
 * El viejo solo cubría 5 tablas y dejaría huérfanos orders/combo_purchases/combo_purchase_items.
 *
 * Modos:
 *   --backup-only        (default) Exporta las 8 tablas a backups/rifa-sede1-final-backup-YYYY-MM-DD.json
 *   --commit --yes       Backup + DELETE en orden por FKs + INSERT rifa sede 2 + populate raffle_numbers 1-2000
 *
 * Lee TURSO_DATABASE_URL y TURSO_AUTH_TOKEN de .env.local
 *
 * Uso:
 *   node scripts/reset-rifa-sede2.mjs                    # solo backup
 *   node scripts/reset-rifa-sede2.mjs --commit --yes     # backup + reset destructivo
 */

import { createClient } from '@libsql/client';
import { writeFile, mkdir } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// override: true es crítico — el shell del dev puede tener TURSO_* exportadas
// apuntando a otra BD (planificador-docente). Sin override, dotenv las respeta
// y el script tocaría la BD equivocada. (Regla CLAUDE.md 2026-05-04.)
loadEnv({ path: '.env.local', override: true });

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const CONFIRMED = args.includes('--yes');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('TURSO_DATABASE_URL y TURSO_AUTH_TOKEN requeridos en .env.local');
  process.exit(1);
}

// Guard extra: confirmar que apuntamos a la BD productiva esperada, no a otra.
if (!TURSO_URL.includes('sistema-de-riffas')) {
  console.error(`ABORT: TURSO_DATABASE_URL no apunta a sistema-de-riffas (es: ${TURSO_URL.slice(0, 40)}...)`);
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Backup: las 8 tablas del schema post-Fase 7.
const BACKUP_TABLES = [
  'raffles',
  'raffle_numbers',
  'orders',
  'purchases',
  'purchase_numbers',
  'event_logs',
  'combo_purchases',
  'combo_purchase_items'
];

// DELETE en orden FK-safe (hijos antes que padres):
//   combo_purchase_items → combo_purchases → orders
//   purchase_numbers     → purchases, raffle_numbers
//   event_logs           → purchases, orders
//   purchases            → orders, raffles
//   raffle_numbers       → raffles
const DELETE_ORDER = [
  'combo_purchase_items',
  'purchase_numbers',
  'event_logs',
  'combo_purchases',
  'purchases',
  'raffle_numbers',
  'orders',
  'raffles'
];

const NEW_RAFFLE = {
  title: 'Rifa Escolar 2026 - Sede 2',
  totalNumbers: 2000,
  pricePerNumber: 1000,
  endDateISO: '2026-12-31T23:59:00.000Z'
};

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function backup() {
  console.log('Backup completo de la BD productiva sistema-de-riffas (8 tablas)');
  const dump = {
    metadata: {
      exportedAt: new Date().toISOString(),
      database: 'sistema-de-riffas',
      reason: 'pre-reset para sede 2 (final sede 1)'
    },
    tables: {}
  };

  for (const t of BACKUP_TABLES) {
    const r = await client.execute(`SELECT * FROM ${t}`);
    const rows = r.rows.map((row) =>
      Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))
    );
    dump.tables[t] = { rowCount: rows.length, columns: r.columns, rows };
    console.log(`  ${t}: ${rows.length} filas`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `rifa-sede1-final-backup-${date}.json`);
  await writeFile(file, JSON.stringify(dump, jsonReplacer, 2));
  console.log(`Backup OK: ${file}`);

  // Verificación de integridad del backup: contar filas en disco vs BD.
  const totalRows = Object.values(dump.tables).reduce((s, t) => s + t.rowCount, 0);
  console.log(`Total filas respaldadas: ${totalRows}`);
  if (totalRows === 0) {
    console.error('ABORT: backup con 0 filas — algo anda mal, no continúo.');
    process.exit(2);
  }
  return file;
}

async function reset() {
  console.log('\nReset + setup rifa sede 2');

  const tx = await client.transaction('write');
  let raffleId;
  try {
    for (const t of DELETE_ORDER) {
      console.log(`  DELETE ${t}`);
      await tx.execute(`DELETE FROM ${t}`);
    }

    const startSec = Math.floor(Date.now() / 1000);
    const endSec = Math.floor(new Date(NEW_RAFFLE.endDateISO).getTime() / 1000);

    console.log(`  INSERT raffle (title="${NEW_RAFFLE.title}")`);
    const ins = await tx.execute({
      sql: `INSERT INTO raffles
              (title, description, total_numbers, price_per_number, start_date, end_date, is_active, created_at, updated_at)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        NEW_RAFFLE.title,
        NEW_RAFFLE.totalNumbers,
        NEW_RAFFLE.pricePerNumber,
        startSec,
        endSec,
        1, // is_active = true → sede 2 abierta
        startSec,
        startSec
      ]
    });
    raffleId = Number(ins.rows[0].id);
    console.log(`    raffle_id=${raffleId}`);

    console.log(`  INSERT ${NEW_RAFFLE.totalNumbers} raffle_numbers (chunks de 500)`);
    const CHUNK = 500;
    for (let start = 1; start <= NEW_RAFFLE.totalNumbers; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, NEW_RAFFLE.totalNumbers);
      const placeholders = [];
      const values = [];
      for (let n = start; n <= end; n++) {
        placeholders.push('(?, ?, ?, ?, ?)');
        values.push(raffleId, n, 'available', startSec, startSec);
      }
      await tx.execute({
        sql: `INSERT INTO raffle_numbers (raffle_id, number, status, created_at, updated_at)
              VALUES ${placeholders.join(',')}`,
        args: values
      });
      console.log(`    ${start}-${end}`);
    }

    await tx.commit();
    console.log('Commit OK');
  } catch (e) {
    await tx.rollback();
    console.error('Rollback. Error:', e.message);
    throw e;
  }

  console.log('\nVerificación post-commit:');
  const verify = await client.execute(`SELECT
    (SELECT COUNT(*) FROM raffles) AS raffles,
    (SELECT COUNT(*) FROM raffle_numbers) AS raffle_numbers,
    (SELECT COUNT(*) FROM raffle_numbers WHERE status='available') AS available,
    (SELECT COUNT(*) FROM raffle_numbers WHERE status!='available') AS no_available,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM purchases) AS purchases,
    (SELECT COUNT(*) FROM purchase_numbers) AS purchase_numbers,
    (SELECT COUNT(*) FROM event_logs) AS event_logs,
    (SELECT COUNT(*) FROM combo_purchases) AS combo_purchases,
    (SELECT COUNT(*) FROM combo_purchase_items) AS combo_purchase_items,
    (SELECT MIN(number) FROM raffle_numbers) AS min_number,
    (SELECT MAX(number) FROM raffle_numbers) AS max_number`);
  const counts = Object.fromEntries(
    verify.columns.map((c, i) => [c, Number(verify.rows[0][i])])
  );
  console.log(' ', counts);

  const cfg = await client.execute(
    'SELECT id, title, total_numbers, price_per_number, is_active FROM raffles'
  );
  console.log('  Rifa activa:', Object.fromEntries(
    cfg.columns.map((c, i) => [c, cfg.rows[0][i]])
  ));

  const ok =
    counts.raffles === 1 &&
    counts.raffle_numbers === NEW_RAFFLE.totalNumbers &&
    counts.available === NEW_RAFFLE.totalNumbers &&
    counts.no_available === 0 &&
    counts.orders === 0 &&
    counts.purchases === 0 &&
    counts.purchase_numbers === 0 &&
    counts.event_logs === 0 &&
    counts.combo_purchases === 0 &&
    counts.combo_purchase_items === 0 &&
    counts.min_number === 1 &&
    counts.max_number === NEW_RAFFLE.totalNumbers;

  if (!ok) {
    console.error('\nVerificación FALLÓ — revisar BD.');
    process.exit(2);
  }
  console.log('\nVerificación OK.');
}

async function main() {
  console.log(`Modo: ${COMMIT ? 'COMMIT (destructivo)' : 'backup-only'}\n`);

  await backup();

  if (!COMMIT) {
    console.log('\nbackup-only completado. Para ejecutar reset:');
    console.log('  node scripts/reset-rifa-sede2.mjs --commit --yes');
    return;
  }

  if (!CONFIRMED) {
    console.error('\n--commit requiere --yes para confirmar el reset destructivo.');
    process.exit(1);
  }

  await reset();
  console.log('\nDONE. Próximo paso: remover gate SALES_CLOSE_TS + redeploy + smoke.');
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(() => client.close());
