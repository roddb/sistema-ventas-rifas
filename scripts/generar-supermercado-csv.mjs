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

  const combosRes = await client.execute(`
    SELECT cp.order_id, cpi.combo_id, SUM(cpi.quantity) AS unidades
    FROM combo_purchases cp
    JOIN combo_purchase_items cpi ON cpi.combo_purchase_id = cp.id
    WHERE cp.payment_status = 'approved' AND cp.order_id IS NOT NULL
    GROUP BY cp.order_id, cpi.combo_id
  `);
  const combosByOrder = new Map();
  for (const row of combosRes.rows) {
    const oid = row.order_id;
    if (!combosByOrder.has(oid)) combosByOrder.set(oid, { carne: 0, chorizo: 0, empanadas: 0 });
    const bucket = combosByOrder.get(oid);
    bucket[row.combo_id] = Number(row.unidades);
  }

  const cursoOf = (course, division) => {
    if (course && division) return `${course}° ${division}`;
    if (course) return `${course}°`;
    return '';
  };

  const rows = orders.map((o) => {
    const nums = numsByOrder.get(o.id) ?? [];
    const combos = combosByOrder.get(o.id) ?? { carne: 0, chorizo: 0, empanadas: 0 };
    return {
      orderId: o.id,
      familia: (o.buyer_name ?? '').trim(),
      alumno: (o.student_name ?? '').trim(),
      curso: cursoOf(o.course, o.division),
      cantNums: nums.length,
      numeros: nums.join(', '),
      carne: combos.carne,
      chorizo: combos.chorizo,
      empanadas: combos.empanadas,
      totalCombos: combos.carne + combos.chorizo + combos.empanadas,
      totalPesos: Number(o.total_amount),
      paidAt: o.paid_at,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.cantNums += r.cantNums;
      acc.carne += r.carne;
      acc.chorizo += r.chorizo;
      acc.empanadas += r.empanadas;
      acc.totalCombos += r.totalCombos;
      acc.totalPesos += r.totalPesos;
      return acc;
    },
    { familias: rows.length, cantNums: 0, carne: 0, chorizo: 0, empanadas: 0, totalCombos: 0, totalPesos: 0 }
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
    'Sandwich Carne',
    'Sandwich Chorizo',
    '3 Empanadas',
    'Total combos',
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
      r.carne || '',
      r.chorizo || '',
      r.empanadas || '',
      r.totalCombos || '',
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
    totals.carne,
    totals.chorizo,
    totals.empanadas,
    totals.totalCombos,
    totals.totalPesos,
    '',
  ].map(escape).join(DELIM));

  const outPath = resolve(process.cwd(), `rifa-supermercado-${new Date().toISOString().slice(0, 10)}.csv`);
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`[supermercado] CSV escrito en: ${outPath}`);

  console.log('\n=== RESUMEN PARA SUPERMERCADO ===');
  console.log(`Familias compradoras: ${totals.familias}`);
  console.log(`Total números rifa vendidos: ${totals.cantNums}`);
  console.log(`Sandwich de carne: ${totals.carne}`);
  console.log(`Sandwich de chorizo: ${totals.chorizo}`);
  console.log(`3 empanadas: ${totals.empanadas}`);
  console.log(`Total combos: ${totals.totalCombos}`);
  console.log(`Recaudación total: $${totals.totalPesos.toLocaleString('es-AR')}`);
}

main()
  .catch((err) => {
    console.error('[supermercado] ERROR:', err);
    process.exit(1);
  })
  .finally(() => client.close());
