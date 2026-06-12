// Genera un CSV (Excel-friendly, BOM UTF-8, delimitador ';') con el detalle
// por familia + totales para compras del supermercado. Read-only contra Turso.
// Uso: node scripts/generar-supermercado-csv.mjs

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv({ path: '.env.local', override: true });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log(`[supermercado] BD: ${process.env.TURSO_DATABASE_URL}`);

  const ordersRes = await client.execute(`
    SELECT id, buyer_name, student_name, course, division, total_amount,
           datetime(updated_at,'unixepoch','localtime') AS paid_at
    FROM orders
    WHERE payment_status = 'approved'
    ORDER BY buyer_name ASC
  `);
  const orders = ordersRes.rows;
  console.log(`[supermercado] orders approved: ${orders.length}`);

  const numsRes = await client.execute(`
    SELECT p.order_id, rn.number
    FROM purchases p
    JOIN purchase_numbers pn ON pn.purchase_id = p.id
    JOIN raffle_numbers rn ON rn.id = pn.raffle_number_id
    WHERE p.payment_status = 'approved' AND p.order_id IS NOT NULL
    ORDER BY p.order_id, rn.number ASC
  `);
  const numsByOrder = new Map();
  for (const row of numsRes.rows) {
    const oid = row.order_id;
    if (!numsByOrder.has(oid)) numsByOrder.set(oid, []);
    numsByOrder.get(oid).push(Number(row.number));
  }

  // Sede 2: único combo de empanadas. quantity = nº de combos; el desglose de
  // gustos (empanadas carne / jamón y queso) vive en flavor_breakdown (JSON).
  const combosRes = await client.execute(`
    SELECT cp.order_id, cpi.combo_id, cpi.quantity, cpi.flavor_breakdown
    FROM combo_purchases cp
    JOIN combo_purchase_items cpi ON cpi.combo_purchase_id = cp.id
    WHERE cp.payment_status = 'approved' AND cp.order_id IS NOT NULL
  `);
  const combosByOrder = new Map();
  for (const row of combosRes.rows) {
    const oid = row.order_id;
    if (!combosByOrder.has(oid)) combosByOrder.set(oid, { combos: 0, carne: 0, jyq: 0 });
    const bucket = combosByOrder.get(oid);
    bucket.combos += Number(row.quantity);
    if (row.flavor_breakdown) {
      try {
        const f = JSON.parse(row.flavor_breakdown);
        bucket.carne += Number(f.carne ?? 0);
        bucket.jyq += Number(f.jyq ?? 0);
      } catch { /* fila sin desglose válido: se ignora el gusto */ }
    }
  }

  const cursoOf = (course, division) => {
    if (course && division) return `${course}° ${division}`;
    if (course) return `${course}°`;
    return '';
  };

  const rows = orders.map((o) => {
    const nums = numsByOrder.get(o.id) ?? [];
    const combos = combosByOrder.get(o.id) ?? { combos: 0, carne: 0, jyq: 0 };
    return {
      orderId: o.id,
      familia: (o.buyer_name ?? '').trim(),
      alumno: (o.student_name ?? '').trim(),
      curso: cursoOf(o.course, o.division),
      cantNums: nums.length,
      numeros: nums.join(', '),
      combos: combos.combos,
      empCarne: combos.carne,
      empJyq: combos.jyq,
      totalPesos: Number(o.total_amount),
      paidAt: o.paid_at,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.cantNums += r.cantNums;
      acc.combos += r.combos;
      acc.empCarne += r.empCarne;
      acc.empJyq += r.empJyq;
      acc.totalPesos += r.totalPesos;
      return acc;
    },
    { familias: rows.length, cantNums: 0, combos: 0, empCarne: 0, empJyq: 0, totalPesos: 0 }
  );

  const DELIM = ';';
  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes(DELIM) || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = [
    'Order ID',
    'Familia',
    'Alumno/a',
    'Curso',
    'Cant. Números',
    'Números',
    'Combos empanadas',
    'Emp. Carne',
    'Emp. Jamón y queso',
    'Total $',
    'Fecha pago',
  ];

  const lines = [];
  lines.push('﻿' + header.map(escape).join(DELIM));
  for (const r of rows) {
    lines.push([
      r.orderId,
      r.familia,
      r.alumno,
      r.curso,
      r.cantNums,
      r.numeros,
      r.combos || '',
      r.empCarne || '',
      r.empJyq || '',
      r.totalPesos,
      r.paidAt,
    ].map(escape).join(DELIM));
  }

  lines.push('');
  lines.push([
    '',
    `TOTAL (${totals.familias} familias)`,
    '',
    '',
    totals.cantNums,
    '',
    totals.combos,
    totals.empCarne,
    totals.empJyq,
    totals.totalPesos,
    '',
  ].map(escape).join(DELIM));

  const outPath = resolve(process.cwd(), `rifa-supermercado-${new Date().toISOString().slice(0, 10)}.csv`);
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`[supermercado] CSV escrito en: ${outPath}`);

  console.log('\n=== RESUMEN PARA SUPERMERCADO / COCINA ===');
  console.log(`Familias compradoras: ${totals.familias}`);
  console.log(`Total números rifa vendidos: ${totals.cantNums}`);
  console.log(`Combos de empanadas: ${totals.combos}`);
  console.log(`Empanadas de carne: ${totals.empCarne}`);
  console.log(`Empanadas de jamón y queso: ${totals.empJyq}`);
  console.log(`Total empanadas: ${totals.empCarne + totals.empJyq}`);
  console.log(`Recaudación total: $${totals.totalPesos.toLocaleString('es-AR')}`);
}

main()
  .catch((err) => {
    console.error('[supermercado] ERROR:', err);
    process.exit(1);
  })
  .finally(() => client.close());
