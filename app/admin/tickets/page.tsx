import { getAdminTicketsSummary, type TicketsSummaryRow } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatCurso(row: TicketsSummaryRow): string {
  if (row.course && row.division) return `${row.course}° ${row.division}`;
  if (row.course) return `${row.course}°`;
  return '—';
}

export default async function AdminTicketsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const rows = await getAdminTicketsSummary();
  const totalNums = rows.reduce((acc, r) => acc + r.numCount, 0);
  const totalCombos = rows.reduce((acc, r) => acc + r.comboUnitsCount, 0);
  const estimatedSheets = Math.max(1, Math.ceil(rows.length / 10));

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Tickets — Rifa Solidaria STA 2026</h1>
          <p style={styles.subtitle}>
            {rows.length} familias · {totalNums} números rifa · {totalCombos} unidades combo · <strong>~{estimatedSheets} hojas A4 a imprimir</strong>
          </p>
        </div>
        <a href="/api/admin/tickets/batch" target="_blank" rel="noopener" style={styles.batchBtn}>
          Imprimir todas las familias →
        </a>
      </header>

      {rows.length === 0 ? (
        <p style={styles.empty}>No hay órdenes approved en la BD.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Alumno/a</th>
              <th style={styles.th}>Curso</th>
              <th style={styles.th}>Adulto (comprador)</th>
              <th style={styles.thNum}>#Rifa</th>
              <th style={styles.thNum}>#Combos</th>
              <th style={styles.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.orderId} style={styles.tr}>
                <td style={styles.td}>{row.studentName ?? <span style={styles.muted}>—</span>}</td>
                <td style={styles.td}>{formatCurso(row)}</td>
                <td style={styles.td}>{row.buyerName}</td>
                <td style={styles.tdNum}>{row.numCount || ''}</td>
                <td style={styles.tdNum}>{row.comboUnitsCount || ''}</td>
                <td style={styles.td}>
                  <a
                    href={`/api/admin/tickets/${row.orderId}`}
                    target="_blank"
                    rel="noopener"
                    style={styles.printLink}
                  >
                    Imprimir
                  </a>
                </td>
              </tr>
            ))}
            <tr style={{ ...styles.tr, borderTop: '2px solid #C9A84C', background: '#FBF5E6', fontWeight: 600 }}>
              <td style={styles.td} colSpan={3}>TOTAL ({rows.length} familias)</td>
              <td style={styles.tdNum}>{totalNums}</td>
              <td style={styles.tdNum}>{totalCombos}</td>
              <td style={styles.td}></td>
            </tr>
          </tbody>
        </table>
      )}

      <footer style={styles.footer}>
        <p>
          Tip: para imprimir, abrí cualquier link y usá <kbd>Cmd</kbd>+<kbd>P</kbd>. Configurar
          el navegador con escala 100% (no &quot;ajustar a página&quot;) y márgenes en cero. Papel A4.
        </p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px 80px',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    color: '#1C1C1C',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  h1: {
    margin: 0,
    fontSize: 24,
    color: '#1A3264',
    letterSpacing: 0.5,
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#5A5A5A',
    fontSize: 13,
  },
  batchBtn: {
    background: '#1A3264',
    color: 'white',
    padding: '10px 18px',
    borderRadius: 4,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
  },
  empty: {
    color: '#5A5A5A',
    padding: 40,
    textAlign: 'center',
    background: '#FAF7F0',
    borderRadius: 4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#EEF2F8',
    color: '#1A3264',
    fontWeight: 600,
    borderBottom: '2px solid #C9A84C',
  },
  thNum: {
    textAlign: 'right',
    padding: '10px 12px',
    background: '#EEF2F8',
    color: '#1A3264',
    fontWeight: 600,
    borderBottom: '2px solid #C9A84C',
    width: 80,
  },
  tr: {
    borderBottom: '1px solid #DDD9D2',
  },
  td: {
    padding: '8px 12px',
    verticalAlign: 'middle',
  },
  tdNum: {
    padding: '8px 12px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    color: '#1A3264',
    fontWeight: 500,
  },
  muted: {
    color: '#A8A4A0',
  },
  printLink: {
    color: '#1A3264',
    textDecoration: 'underline',
    fontWeight: 500,
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1px solid #DDD9D2',
    fontSize: 12,
    color: '#5A5A5A',
  },
};
