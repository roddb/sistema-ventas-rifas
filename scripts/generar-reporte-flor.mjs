// Reporte de movimientos approved para auditoría de caja (Flor).
// CSV Excel-friendly con detalle por order + breakdown por método de pago.
// Read-only contra Turso productiva.
// Uso: node scripts/generar-reporte-flor.mjs

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv({ path: '.env.local', override: true });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const DELIM = ';';
const escape = (v) => {
  const s = String(v ?? '');
  if (s.includes(DELIM) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

const cursoOf = (course, division) => {
  if (course && division) return `${course}° ${division}`;
  if (course) return `${course}°`;
  return '';
};

const formatMethod = (m) => {
  if (!m) return '(sin dato)';
  const map = {
    account_money: 'Dinero en cuenta MP',
    credit_card: 'Tarjeta de crédito',
    debit_card: 'Tarjeta de débito',
    ticket: 'Efectivo (Rapipago/PagoFácil)',
    bank_transfer: 'Transferencia bancaria',
  };
  return map[m] ?? m;
};

async function main() {
  console.log(`[reporte-flor] BD: ${process.env.TURSO_DATABASE_URL}`);

  // Orders approved ordenadas cronológicamente por fecha de pago
  const ordersRes = await client.execute(`
    SELECT id, buyer_name, email, phone, student_name, course, division,
           total_amount, payment_method, mercado_pago_payment_id,
           has_raffle, has_combos,
           datetime(updated_at, 'unixepoch', 'localtime') AS paid_at,
           updated_at AS paid_at_ts
    FROM orders
    WHERE payment_status = 'approved'
    ORDER BY updated_at ASC
  `);
  const orders = ordersRes.rows;
  console.log(`[reporte-flor] orders approved: ${orders.length}`);

  // Contar números rifa por order
  const numsRes = await client.execute(`
    SELECT p.order_id, COUNT(*) AS n
    FROM purchases p
    JOIN purchase_numbers pn ON pn.purchase_id = p.id
    WHERE p.payment_status = 'approved' AND p.order_id IS NOT NULL
    GROUP BY p.order_id
  `);
  const numsByOrder = new Map();
  for (const r of numsRes.rows) numsByOrder.set(r.order_id, Number(r.n));

  // Combos por order (agrupados por tipo)
  const combosRes = await client.execute(`
    SELECT cp.order_id, cpi.combo_id, SUM(cpi.quantity) AS unidades
    FROM combo_purchases cp
    JOIN combo_purchase_items cpi ON cpi.combo_purchase_id = cp.id
    WHERE cp.payment_status = 'approved' AND cp.order_id IS NOT NULL
    GROUP BY cp.order_id, cpi.combo_id
  `);
  const combosByOrder = new Map();
  for (const r of combosRes.rows) {
    const oid = r.order_id;
    if (!combosByOrder.has(oid)) combosByOrder.set(oid, []);
    const label =
      r.combo_id === 'carne' ? 'S. carne' :
      r.combo_id === 'chorizo' ? 'S. chorizo' :
      r.combo_id === 'empanadas' ? '3 empanadas' : r.combo_id;
    combosByOrder.get(oid).push(`${Number(r.unidades)}× ${label}`);
  }

  // Construir filas
  const rows = orders.map((o) => {
    const nNums = numsByOrder.get(o.id) ?? 0;
    const combos = combosByOrder.get(o.id) ?? [];
    const items = [
      nNums > 0 ? `${nNums} núm.` : null,
      ...combos,
    ].filter(Boolean).join(' + ') || '(vacío)';

    return {
      orderId: o.id,
      familia: (o.buyer_name ?? '').trim(),
      email: (o.email ?? '').trim(),
      telefono: (o.phone ?? '').trim(),
      alumno: (o.student_name ?? '').trim(),
      curso: cursoOf(o.course, o.division),
      items,
      totalPesos: Number(o.total_amount),
      metodoPago: formatMethod(o.payment_method),
      mpPaymentId: o.mercado_pago_payment_id ?? '',
      paidAt: o.paid_at,
    };
  });

  // Totales por método de pago
  const byMethod = new Map();
  for (const r of rows) {
    const key = r.metodoPago;
    if (!byMethod.has(key)) byMethod.set(key, { count: 0, total: 0 });
    byMethod.get(key).count += 1;
    byMethod.get(key).total += r.totalPesos;
  }
  const methodEntries = [...byMethod.entries()].sort((a, b) => b[1].total - a[1].total);

  const totals = {
    orders: rows.length,
    monto: rows.reduce((acc, r) => acc + r.totalPesos, 0),
  };

  const header = [
    'N°',
    'Fecha pago (ART)',
    'Order ID',
    'Familia',
    'Email',
    'Teléfono',
    'Alumno/a',
    'Curso',
    'Items comprados',
    'Total $',
    'Método de pago',
    'MP Payment ID',
  ];

  const lines = [];
  lines.push('﻿' + header.map(escape).join(DELIM));
  rows.forEach((r, i) => {
    lines.push([
      i + 1,
      r.paidAt,
      r.orderId,
      r.familia,
      r.email,
      r.telefono,
      r.alumno,
      r.curso,
      r.items,
      r.totalPesos,
      r.metodoPago,
      r.mpPaymentId,
    ].map(escape).join(DELIM));
  });

  // Totales
  lines.push('');
  lines.push([
    '',
    '',
    '',
    `TOTAL: ${totals.orders} ventas`,
    '',
    '',
    '',
    '',
    '',
    totals.monto,
    '',
    '',
  ].map(escape).join(DELIM));

  // Breakdown por método de pago
  lines.push('');
  lines.push(['', '', '', 'BREAKDOWN POR MÉTODO DE PAGO', '', '', '', '', '', '', '', ''].map(escape).join(DELIM));
  lines.push(['', '', '', 'Método', '', '', '', '', 'Cant. ventas', 'Monto', '%', ''].map(escape).join(DELIM));
  for (const [method, agg] of methodEntries) {
    const pct = ((agg.total / totals.monto) * 100).toFixed(1) + '%';
    lines.push([
      '',
      '',
      '',
      method,
      '',
      '',
      '',
      '',
      agg.count,
      agg.total,
      pct,
      '',
    ].map(escape).join(DELIM));
  }

  const outPath = resolve(
    process.cwd(),
    `rifa-reporte-flor-${new Date().toISOString().slice(0, 10)}.csv`
  );
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`[reporte-flor] CSV escrito en: ${outPath}`);

  console.log('\n=== RESUMEN PARA FLOR ===');
  console.log(`Período: ${rows[0]?.paidAt ?? '?'} → ${rows[rows.length - 1]?.paidAt ?? '?'}`);
  console.log(`Total ventas approved: ${totals.orders}`);
  console.log(`Recaudación total: $${totals.monto.toLocaleString('es-AR')}`);
  console.log('\nDesglose por método de pago:');
  for (const [method, agg] of methodEntries) {
    const pct = ((agg.total / totals.monto) * 100).toFixed(1) + '%';
    console.log(`  ${method}: ${agg.count} ventas · $${agg.total.toLocaleString('es-AR')} (${pct})`);
  }
}

main()
  .catch((err) => {
    console.error('[reporte-flor] ERROR:', err);
    process.exit(1);
  })
  .finally(() => client.close());
