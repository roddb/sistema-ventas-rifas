#!/usr/bin/env node
/**
 * setup-rifa-2026.mjs — Backup + reset de la BD productiva para iniciar la rifa 2026.
 *
 * Modos:
 *   --backup-only        (default) Exporta las 5 tablas a backups/rifa-2025-backup-YYYY-MM-DD.json
 *   --commit --yes       Backup + DELETE en orden por FKs + INSERT rifa 2026 + populate raffle_numbers 1-2000
 *
 * Lee TURSO_DATABASE_URL y TURSO_AUTH_TOKEN de .env.local
 *
 * Uso:
 *   node scripts/setup-rifa-2026.mjs                    # solo backup
 *   node scripts/setup-rifa-2026.mjs --commit --yes     # backup + reset destructivo
 */

import { createClient } from '@libsql/client';
import { writeFile, mkdir } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// override: true es crítico — el shell del dev puede tener TURSO_* exportadas
// apuntando a otra BD. Sin override, dotenv las respeta y el script tocaría la BD equivocada.
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

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const TABLES = ['raffles', 'raffle_numbers', 'purchases', 'purchase_numbers', 'event_logs'];

const NEW_RAFFLE = {
  title: 'Rifa Escolar 2026',
  totalNumbers: 2000,
  pricePerNumber: 2000,
  endDateISO: '2026-12-31T23:59:00.000Z'
};

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function backup() {
  console.log('Backup de la BD productiva sistema-de-riffas');
  const dump = {
    metadata: {
      exportedAt: new Date().toISOString(),
      database: 'sistema-de-riffas',
      reason: 'pre-reset rifa 2026'
    },
    tables: {}
  };

  for (const t of TABLES) {
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
  const file = path.join(dir, `rifa-2025-backup-${date}.json`);
  await writeFile(file, JSON.stringify(dump, jsonReplacer, 2));
  console.log(`Backup OK: ${file}`);
  return file;
}

async function reset() {
  console.log('\nReset + setup rifa 2026');

  const tx = await client.transaction('write');
  let raffleId;
  try {
    // Orden por FKs: event_logs.purchase_id → purchases.id (FK), por eso event_logs ANTES que purchases.
    console.log('  DELETE purchase_numbers');
    await tx.execute('DELETE FROM purchase_numbers');
    console.log('  DELETE event_logs');
    await tx.execute('DELETE FROM event_logs');
    console.log('  DELETE purchases');
    await tx.execute('DELETE FROM purchases');
    console.log('  DELETE raffle_numbers');
    await tx.execute('DELETE FROM raffle_numbers');
    console.log('  DELETE raffles');
    await tx.execute('DELETE FROM raffles');

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
        1,
        startSec,
        startSec
      ]
    });
    raffleId = Number(ins.rows[0].id);
    console.log(`    raffle_id=${raffleId}`);

    console.log(`  INSERT 2000 raffle_numbers (chunks de 500)`);
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
    (SELECT COUNT(*) FROM purchases) AS purchases,
    (SELECT COUNT(*) FROM purchase_numbers) AS purchase_numbers,
    (SELECT COUNT(*) FROM event_logs) AS event_logs,
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
    counts.raffle_numbers === 2000 &&
    counts.available === 2000 &&
    counts.no_available === 0 &&
    counts.purchases === 0 &&
    counts.purchase_numbers === 0 &&
    counts.event_logs === 0 &&
    counts.min_number === 1 &&
    counts.max_number === 2000;

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
    console.log('  node scripts/setup-rifa-2026.mjs --commit --yes');
    return;
  }

  if (!CONFIRMED) {
    console.error('\n--commit requiere --yes para confirmar el reset destructivo.');
    process.exit(1);
  }

  await reset();
  console.log('\nDONE. Próximo paso: smoke test UI productiva.');
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(() => client.close());
