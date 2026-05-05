import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rifa STA 2026',
  description: 'Comprá tu número de la Gran Rifa STA 2026.',
  keywords: 'rifa, STA, sorteo, números, colegio',
  authors: [{ name: 'Colegio STA' }],
  openGraph: {
    title: 'Rifa STA 2026',
    description: 'Comprá tu número de la Gran Rifa STA 2026.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased bg-surface text-ink">
        {children}
      </body>
    </html>
  );
}