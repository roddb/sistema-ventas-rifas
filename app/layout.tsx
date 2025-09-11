import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sistema de Rifas Escolares',
  description: 'Sistema de venta de rifas con gestión de 2000 números',
  keywords: 'rifas, escuela, sorteo, números, compra',
  authors: [{ name: 'Colegio' }],
  openGraph: {
    title: 'Sistema de Rifas Escolares',
    description: 'Compra tus números de la suerte para el sorteo escolar',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}