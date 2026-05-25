import { ticketsStyles } from './styles';
import type { OrderTicketData, FamilyIdentity, ComboTicket } from './queries';

const SORTEO_DATE = '29 de mayo de 2026';

function escapeHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function padNumber(n: number): string {
  return String(n).padStart(4, '0');
}

function familyShortName(family: FamilyIdentity): string {
  return escapeHtml(family.buyerName.trim());
}

function familyDetailLine(family: FamilyIdentity): string {
  const parts: string[] = [escapeHtml(family.buyerName.trim())];
  if (family.studentName && family.studentName.trim()) {
    parts.push(escapeHtml(family.studentName.trim()));
  }
  if (family.course && family.division) {
    parts.push(`${escapeHtml(family.course)}° ${escapeHtml(family.division)}`);
  } else if (family.course) {
    parts.push(`${escapeHtml(family.course)}°`);
  }
  return parts.join(' · ');
}

function renderHeaderInstitucional(): string {
  return `
    <div class="filete-dorado"></div>
    <div class="header-content">
      <img src="/img/escudo-sta.png" alt="Escudo STA" class="escudo" />
      <div class="wordmark">
        <div class="institucion">SANTO TOMÁS DE AQUINO</div>
        <div class="tagline">Rifa Solidaria 2026 · Hoja de boletos por familia</div>
      </div>
    </div>
  `;
}

function renderBloqueFamilia(family: FamilyIdentity): string {
  const parts: string[] = [];
  parts.push(`<span><b>Familia:</b> ${escapeHtml(family.buyerName.trim())}</span>`);
  if (family.studentName && family.studentName.trim()) {
    parts.push(`<span><b>Alumno/a:</b> ${escapeHtml(family.studentName.trim())}</span>`);
  }
  if (family.course && family.division) {
    parts.push(`<span><b>Curso:</b> ${escapeHtml(family.course)}° ${escapeHtml(family.division)}</span>`);
  } else if (family.course) {
    parts.push(`<span><b>Curso:</b> ${escapeHtml(family.course)}°</span>`);
  }
  return `<div class="bloque-familia">${parts.join('')}</div>`;
}

function renderTicketRifa(number: number, family: FamilyIdentity): string {
  return `
    <div class="ticket rifa">
      <div class="ticket-main">
        <div class="ticket-eyebrow">Boleto N°</div>
        <div class="ticket-numero">${padNumber(number)}</div>
      </div>
      <div class="ticket-info">
        <div class="principal">${familyDetailLine(family)}</div>
        <span class="sub">Sorteo: ${SORTEO_DATE}</span>
        <span class="sub">Conservar para reclamar premio</span>
      </div>
      <img src="/img/escudo-sta.png" alt="STA" class="ticket-escudo" />
    </div>
  `;
}

function renderTicketCombo(combo: ComboTicket, idx: number, total: number, family: FamilyIdentity): string {
  const canjeText = total === 1
    ? 'Canje único'
    : `Canje único — ${idx} de ${total}`;
  return `
    <div class="ticket combo">
      <div class="ticket-main">
        <div class="ticket-eyebrow">Combo</div>
        <div class="ticket-combo-nombre">${escapeHtml(combo.comboNameSnapshot)}</div>
      </div>
      <div class="ticket-info">
        <div class="principal">${familyShortName(family)} · ${canjeText}</div>
        <span class="sub">Presentar en el stand para retirar</span>
        <span class="sub">Válido sólo el día del evento</span>
      </div>
      <img src="/img/escudo-sta.png" alt="STA" class="ticket-escudo" />
    </div>
  `;
}

function renderFooterHoja(family: FamilyIdentity): string {
  return `
    <div class="footer-hoja">
      <span class="izq">STA · Rifa Solidaria 2026</span>
      <span>Familia ${familyShortName(family)}</span>
    </div>
  `;
}

function renderHojaInner(data: OrderTicketData): string {
  const ticketsRifa = data.rifas
    .map((r) => renderTicketRifa(r.number, data.family))
    .join('');

  const ticketsCombo = data.combos
    .map((combo) =>
      Array.from({ length: combo.quantity }, (_, i) =>
        renderTicketCombo(combo, i + 1, combo.quantity, data.family)
      ).join('')
    )
    .join('');

  return `
    <div class="hoja">
      ${renderHeaderInstitucional()}
      ${renderBloqueFamilia(data.family)}
      <div class="tickets-container">
        ${ticketsRifa}
        ${ticketsCombo}
      </div>
      ${renderFooterHoja(data.family)}
    </div>
  `;
}

function wrapDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${ticketsStyles}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function renderHoja(data: OrderTicketData): string {
  return wrapDocument(
    renderHojaInner(data),
    `Tickets — Familia ${data.family.buyerName}`
  );
}

export function renderBatch(allData: OrderTicketData[]): string {
  if (allData.length === 0) {
    return wrapDocument(
      `<div style="padding:40px;text-align:center;font-family:sans-serif;color:#666">Sin órdenes para imprimir.</div>`,
      'Tickets — Batch'
    );
  }
  const hojas = allData.map(renderHojaInner).join('\n');
  return wrapDocument(hojas, `Tickets — Batch (${allData.length} familias)`);
}
