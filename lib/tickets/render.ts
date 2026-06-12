import { ticketsStyles } from './styles';
import type { OrderTicketData, FamilyIdentity, ComboTicket } from './queries';

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

function abbreviateCombo(name: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'combo de empanadas') return 'Empanadas';
  return trimmed;
}

function renderFlavorChip(label: string, count: number): string {
  return `<span class="chk-item combo"><span class="chk combo"></span>${escapeHtml(label)} ×${count}</span>`;
}

function renderFamiliaBlock(family: FamilyIdentity): string {
  const adulto = escapeHtml(family.buyerName.trim());
  // 12.3: el ALUMNO va primero (+ curso); el adulto comprador, al lado.
  if (family.studentName && family.studentName.trim()) {
    let curso = '';
    if (family.course && family.division) {
      curso = `${escapeHtml(family.course)}° ${escapeHtml(family.division)}`;
    } else if (family.course) {
      curso = `${escapeHtml(family.course)}°`;
    }
    return `
      <span class="p-alumno">${escapeHtml(family.studentName.trim())}</span>
      ${curso ? `<span class="p-curso">${curso}</span>` : ''}
      <span class="p-sep">·</span>
      <span class="p-adulto"><span class="lbl">compró:</span> ${adulto}</span>
    `;
  }
  // Order sin alumno (solo combos): el adulto pasa a ser el foco.
  return `
    <span class="p-alumno">${adulto}</span>
    <span class="p-sep">·</span>
    <span class="p-adulto muted">(solo combos)</span>
  `;
}

function renderRifaChip(number: number): string {
  return `<span class="chk-item"><span class="chk"></span>${padNumber(number)}</span>`;
}

function renderComboChip(combo: ComboTicket, idx: number, total: number): string {
  const name = escapeHtml(abbreviateCombo(combo.comboNameSnapshot));
  const sufijo = total > 1 ? ` ${idx}/${total}` : '';
  return `<span class="chk-item combo"><span class="chk combo"></span>${name}${sufijo}</span>`;
}

function renderPapel(data: OrderTicketData): string {
  const totalNums = data.rifas.length;
  const totalCombos = data.combos.reduce((acc, c) => acc + c.quantity, 0);

  const rifaChips = data.rifas.map((r) => renderRifaChip(r.number)).join('');
  const comboChips = data.combos
    .map((combo) => {
      // Combo de empanadas: un chip por gusto (Carne ×3 / J. y queso ×1).
      if (combo.comboId === 'empanadas' && combo.flavors) {
        const chips: string[] = [];
        if (combo.flavors.carne > 0) chips.push(renderFlavorChip('Carne', combo.flavors.carne));
        if (combo.flavors.jyq > 0) chips.push(renderFlavorChip('J. y queso', combo.flavors.jyq));
        return chips.join('');
      }
      // Otros combos (legacy): un chip por unidad.
      return Array.from({ length: combo.quantity }, (_, i) =>
        renderComboChip(combo, i + 1, combo.quantity)
      ).join('');
    })
    .join('');

  const rifaGroup = totalNums > 0
    ? `<span class="p-group-label rifa">Rifa <b>(${totalNums}):</b></span>${rifaChips}`
    : '';
  const comboGroup = totalCombos > 0
    ? `<span class="p-group-label combo">Combos <b>(${totalCombos}):</b></span>${comboChips}`
    : '';
  const divider = totalNums > 0 && totalCombos > 0
    ? `<span class="p-divider">·</span>`
    : '';

  return `
    <div class="papel">
      <div class="p-bar"></div>
      <div class="p-body">
        <div class="p-l1">
          <div class="p-fam-block">
            ${renderFamiliaBlock(data.family)}
          </div>
          <div class="p-side">
            <span class="p-firma">Firma:____________</span>
          </div>
        </div>
        <div class="p-l2">
          ${rifaGroup}
          ${divider}
          ${comboGroup}
        </div>
      </div>
      <img src="/img/escudo-sta.png" alt="STA" class="p-escudo" />
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
    `<div class="hoja">${renderPapel(data)}</div>`,
    `Tickets — Familia ${data.family.buyerName}`
  );
}

export function renderBatch(allData: OrderTicketData[]): string {
  if (allData.length === 0) {
    return wrapDocument(
      `<div class="hoja"><div style="padding:40px;text-align:center;color:#666">Sin órdenes para imprimir.</div></div>`,
      'Tickets — Batch'
    );
  }
  const papeles = allData.map(renderPapel).join('\n');
  return wrapDocument(
    `<div class="hoja">${papeles}</div>`,
    `Tickets — Batch (${allData.length} familias)`
  );
}
