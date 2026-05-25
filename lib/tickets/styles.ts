export const ticketsStyles = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@0,400;0,500;0,600;0,700&display=swap');

:root {
  --sta-azul: #1A3264;
  --sta-azul-medio: #2B4A82;
  --sta-azul-palido: #EEF2F8;
  --sta-dorado: #C9A84C;
  --sta-dorado-oscuro: #A68A3E;
  --sta-dorado-palido: #FBF5E6;
  --sta-crema: #FAF7F0;
  --sta-fondo: #FFFFFF;
  --sta-texto: #1C1C1C;
  --sta-texto-sec: #5A5A5A;
  --sta-linea: #C8C4BC;
  --sta-linea-suave: #DDD9D2;
  --sta-fuente-titulo: 'EB Garamond', Georgia, serif;
  --sta-fuente-cuerpo: 'Inter', 'Helvetica Neue', Arial, sans-serif;
}

@page {
  size: A4;
  margin: 0;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--sta-fuente-cuerpo);
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
  background: var(--sta-fondo);
  margin: 0 auto 8mm;
  position: relative;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.hoja:last-child { page-break-after: auto; }

.filete-dorado {
  height: 6mm;
  background: var(--sta-dorado);
  flex-shrink: 0;
}

.header-content {
  padding: 6mm 15mm 4mm;
  display: flex;
  gap: 8mm;
  align-items: center;
  border-bottom: 1px solid var(--sta-linea-suave);
}

.escudo {
  width: 18mm;
  height: 18mm;
  object-fit: contain;
  flex-shrink: 0;
}

.wordmark { flex: 1; }

.institucion {
  font-family: var(--sta-fuente-titulo);
  font-size: 20pt;
  font-weight: 700;
  color: var(--sta-azul);
  letter-spacing: 1.5px;
  line-height: 1;
}

.tagline {
  font-family: var(--sta-fuente-titulo);
  font-style: italic;
  font-size: 10pt;
  color: var(--sta-texto-sec);
  margin-top: 3px;
}

.bloque-familia {
  margin: 5mm 15mm 4mm;
  padding: 8px 12px;
  background: var(--sta-azul-palido);
  border-left: 3px solid var(--sta-dorado);
  font-size: 10pt;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.bloque-familia b {
  color: var(--sta-azul);
  font-weight: 600;
}

.tickets-container {
  padding: 0 15mm;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.ticket {
  page-break-inside: avoid;
  break-inside: avoid;
  border-top: 1.5px dashed var(--sta-linea);
  position: relative;
  padding: 8px 12px 8px 16px;
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 26mm;
  margin-top: 2mm;
}

.ticket::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2mm;
  bottom: 0;
  width: 4mm;
}

.ticket::after {
  content: 'CORTAR';
  position: absolute;
  top: -7px;
  right: 8px;
  font-size: 7pt;
  color: var(--sta-texto-sec);
  background: white;
  padding: 0 4px;
  letter-spacing: 0.8px;
  font-family: var(--sta-fuente-cuerpo);
}

.ticket.rifa { background: var(--sta-dorado-palido); }
.ticket.rifa::before { background: var(--sta-dorado); }

.ticket.combo { background: var(--sta-azul-palido); }
.ticket.combo::before { background: var(--sta-azul); }

.ticket-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ticket-eyebrow {
  font-family: var(--sta-fuente-titulo);
  font-size: 8pt;
  letter-spacing: 1.5px;
  font-weight: 600;
  text-transform: uppercase;
}

.ticket.rifa .ticket-eyebrow { color: var(--sta-dorado-oscuro); }
.ticket.combo .ticket-eyebrow { color: var(--sta-azul-medio); }

.ticket-numero {
  font-family: var(--sta-fuente-titulo);
  font-size: 32pt;
  font-weight: 700;
  color: var(--sta-azul);
  line-height: 1;
  letter-spacing: 1px;
}

.ticket-combo-nombre {
  font-family: var(--sta-fuente-titulo);
  font-size: 17pt;
  font-weight: 700;
  color: var(--sta-azul);
  line-height: 1.1;
}

.ticket-info {
  flex: 1;
  font-size: 10pt;
  line-height: 1.5;
  color: var(--sta-texto);
  min-width: 0;
}

.ticket-escudo {
  width: 16mm;
  height: 16mm;
  object-fit: contain;
  flex-shrink: 0;
  margin-right: 4mm;
  opacity: 0.95;
}

.ticket-info .principal {
  font-weight: 500;
  margin-bottom: 4px;
}

.ticket-info .sub {
  color: var(--sta-texto-sec);
  font-size: 9pt;
  display: block;
}

.footer-hoja {
  margin-top: auto;
  padding: 3mm 15mm 5mm;
  border-top: 1px solid var(--sta-linea-suave);
  display: flex;
  justify-content: space-between;
  font-size: 8pt;
  color: var(--sta-texto-sec);
  font-family: var(--sta-fuente-cuerpo);
}

.footer-hoja .izq {
  color: var(--sta-azul);
  font-weight: 600;
}
`;
