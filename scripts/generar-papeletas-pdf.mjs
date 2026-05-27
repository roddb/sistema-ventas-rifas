// Genera PDF con papeletas de números vendidos (sold) para el sorteo físico.
// Layout: grid A4 de cuadraditos 15mm × 15mm con borde dashed (para recortar)
// y meter en una bolsa el día del sorteo.
//
// Densidad: 12 columnas × ~17 filas = ~204 papeletas por A4.
// Para 720 nums vendidos → ~4 hojas A4.
//
// Uso:
//   node scripts/generar-papeletas-pdf.mjs
//   (requiere Google Chrome instalado en /Applications/Google Chrome.app)
//
// Output:
//   /tmp/papeletas.html (intermediate)
//   papeletas-sorteo-YYYY-MM-DD.pdf en raíz del repo
//
// Read-only contra Turso productiva.

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

loadEnv({ path: '.env.local', override: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log(`[papeletas] BD: ${process.env.TURSO_DATABASE_URL}`);

  const res = await client.execute(`
    SELECT number FROM raffle_numbers
    WHERE status = 'sold'
    ORDER BY number ASC
  `);
  const numbers = res.rows.map((r) => Number(r.number));
  console.log(`[papeletas] números vendidos (sold): ${numbers.length}`);
  console.log(`[papeletas] rango: ${numbers[0]} → ${numbers[numbers.length - 1]}`);

  const html = renderHtml(numbers);
  const htmlPath = '/tmp/papeletas.html';
  writeFileSync(htmlPath, html, 'utf-8');
  console.log(`[papeletas] HTML escrito en ${htmlPath} (${html.length} bytes)`);

  const pdfPath = resolve(
    process.cwd(),
    `papeletas-sorteo-${new Date().toISOString().slice(0, 10)}.pdf`
  );

  console.log(`[papeletas] generando PDF con Chrome headless...`);
  execSync(
    `"${CHROME}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file://${htmlPath}"`,
    { stdio: 'inherit' }
  );

  console.log(`\n=== PAPELETAS GENERADAS ===`);
  console.log(`Total: ${numbers.length} números`);
  console.log(`PDF: ${pdfPath}`);
}

function renderHtml(numbers) {
  const cells = numbers
    .map((n) => `<div class="p">${n}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Papeletas sorteo - Rifa STA 2026</title>
<style>
  @page {
    size: A4;
    margin: 6mm;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: #1E3A8A;
  }
  .titulo {
    font-size: 10pt;
    font-weight: 700;
    text-align: center;
    margin: 0 0 3mm 0;
    color: #1E3A8A;
    letter-spacing: 0.5px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(12, 15mm);
    grid-auto-rows: 15mm;
    gap: 1mm;
    justify-content: center;
  }
  .p {
    border: 0.5px dashed #6B7280;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13pt;
    font-weight: 800;
    color: #1E3A8A;
    background: #ffffff;
    line-height: 1;
  }
</style>
</head>
<body>
  <div class="titulo">RIFA STA 2026 · ${numbers.length} papeletas para recortar y meter en bolsa</div>
  <div class="grid">${cells}</div>
</body>
</html>`;
}

main()
  .catch((err) => {
    console.error('[papeletas] ERROR:', err);
    process.exit(1);
  })
  .finally(() => client.close());
