export const ticketsStyles = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --sta-azul: #1A3264;
  --sta-azul-medio: #2B4A82;
  --sta-azul-palido: #EEF2F8;
  --sta-dorado: #C9A84C;
  --sta-dorado-oscuro: #A68A3E;
  --sta-dorado-palido: #FBF5E6;
  --sta-texto: #1C1C1C;
  --sta-texto-sec: #5A5A5A;
  --sta-linea: #C8C4BC;
  --sta-linea-suave: #DDD9D2;
}

@page { size: A4; margin: 0; }

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  color: var(--sta-texto);
  background: #d8d5cf;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

@media print {
  html, body { background: white; }
  .hoja { box-shadow: none !important; margin: 0 !important; }
}

.hoja {
  width: 210mm;
  min-height: 297mm;
  background: white;
  margin: 0 auto 8mm;
  padding: 6mm 8mm;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ===== Papel familia (control + entregable unificado) ===== */
.papel {
  position: relative;
  background: var(--sta-azul-palido);
  display: flex;
  align-items: stretch;
  margin-bottom: 3mm;
  page-break-inside: avoid;
  break-inside: avoid;
  border: 0.5px solid var(--sta-linea-suave);
}
.papel:last-child { margin-bottom: 0; }

.p-bar {
  width: 4mm;
  background: var(--sta-azul);
  flex-shrink: 0;
}

.p-body {
  flex: 1;
  padding: 2.5mm 3mm 2.5mm 4mm;
  min-width: 0;
}

.p-l1 {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6mm;
  margin-bottom: 1.5mm;
}

.p-fam-block {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
}

.p-familia {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 13pt;
  font-weight: 700;
  color: var(--sta-azul);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.p-sep { color: var(--sta-texto-sec); font-size: 10pt; }

.p-student {
  font-size: 9.5pt;
  color: var(--sta-texto);
  font-weight: 500;
}

.p-side {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 8pt;
  color: var(--sta-texto-sec);
  flex-shrink: 0;
  white-space: nowrap;
}

.p-firma { font-style: italic; }

.p-l2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px 8px;
  font-size: 8.5pt;
  line-height: 1.4;
}

.p-group-label {
  font-weight: 600;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 2px;
}
.p-group-label.rifa { color: var(--sta-dorado-oscuro); }
.p-group-label.combo { color: var(--sta-azul-medio); }
.p-group-label b { font-weight: 700; }

.p-divider {
  color: var(--sta-linea);
  font-weight: 700;
  font-size: 12pt;
  margin: 0 3px;
}

.chk-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  background: white;
  padding: 1px 5px;
  border-radius: 2px;
  border: 0.5px solid var(--sta-dorado-palido);
}
.chk-item.combo { border-color: var(--sta-azul-palido); }

.chk {
  display: inline-block;
  width: 9px;
  height: 9px;
  border: 1.3px solid var(--sta-dorado-oscuro);
  background: white;
  border-radius: 1.5px;
  flex-shrink: 0;
}
.chk.combo { border-color: var(--sta-azul); }

.muted { color: var(--sta-texto-sec); font-style: italic; }

.p-escudo {
  width: 11mm;
  height: 11mm;
  object-fit: contain;
  flex-shrink: 0;
  margin: auto 3mm;
  opacity: 0.95;
}
`;
