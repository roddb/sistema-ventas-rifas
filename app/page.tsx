'use client'

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'

// Importar el componente RifasApp dinámicamente para evitar problemas de SSR
const RifasApp = dynamic<ComponentType<{}>>(
  () => import('@/components/RifasApp').then((mod) => mod.default as ComponentType<{}>),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando sistema de rifas...</p>
        </div>
      </div>
    )
  }
)

export default function Home() {
  return <RifasApp />
}