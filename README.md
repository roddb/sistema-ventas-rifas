# Sistema de Ventas de Rifas Escolares 🎫

Sistema completo para gestión de venta de rifas escolares con 2000 números, integración de pagos con MercadoPago y base de datos Turso.

## 🚀 Características

- ✅ Grilla interactiva de 100x20 (2000 números)
- ✅ Sistema de reservas temporales (15 minutos)
- ✅ Integración completa con MercadoPago
- ✅ Base de datos SQLite Edge (Turso)
- ✅ Panel de administración
- ✅ Notificaciones por email
- ✅ Diseño responsive
- ✅ TypeScript + Next.js 14

## 📋 Requisitos Previos

- Node.js 18+ 
- Cuenta en [Turso](https://turso.tech)
- Cuenta en [MercadoPago](https://www.mercadopago.com.ar/developers)
- Cuenta en [Vercel](https://vercel.com) (para deployment)

## 🛠️ Instalación Local

1. **Clonar el repositorio**
```bash
git clone https://github.com/roddb/sistema-ventas-rifas.git
cd sistema-ventas-rifas
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Copiar `.env.example` a `.env.local` y completar:

```env
# Turso Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# MercadoPago
MERCADO_PAGO_ACCESS_TOKEN=your-access-token
MERCADO_PAGO_PUBLIC_KEY=your-public-key
MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. **Configurar Base de Datos Turso**

```bash
# Instalar Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Crear base de datos
turso db create rifas-db

# Obtener URL y token
turso db show rifas-db --url
turso db tokens create rifas-db
```

5. **Ejecutar migraciones**

```bash
npm run db:generate
npm run db:migrate
```

6. **Iniciar servidor de desarrollo**

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment en Vercel

### Opción 1: Deploy con Vercel CLI

```bash
npm i -g vercel
vercel
```

### Opción 2: Deploy desde GitHub

1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "New Project"
3. Importar repositorio de GitHub
4. Configurar variables de entorno:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `MERCADO_PAGO_PUBLIC_KEY`
   - `MERCADO_PAGO_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_BASE_URL` (usar dominio de producción)
5. Deploy

## 📝 Configuración de MercadoPago

1. **Obtener credenciales**
   - Ir a [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
   - Crear aplicación
   - Copiar Access Token y Public Key

2. **Configurar Webhooks**
   - En el panel de MercadoPago, configurar webhook URL:
   ```
   https://tu-dominio.vercel.app/api/webhooks/mercadopago
   ```
   - Eventos a escuchar: `payment`

## 📁 Estructura del Proyecto

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── numbers/       # Obtener números
│   │   ├── purchase/      # Crear compra
│   │   └── webhooks/      # MercadoPago webhooks
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página principal
├── components/            # Componentes React
│   └── RifasApp.tsx      # Componente principal
├── lib/                   # Librerías y servicios
│   ├── db/               # Configuración BD
│   │   ├── schema.ts     # Esquema Drizzle
│   │   └── index.ts      # Cliente Turso
│   ├── services/         # Lógica de negocio
│   └── mercadopago.ts    # Config MercadoPago
└── public/               # Archivos estáticos
```

## 🔧 Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Iniciar servidor de producción
npm run lint         # Linter
npm run db:generate  # Generar migraciones
npm run db:migrate   # Aplicar migraciones
npm run db:studio    # Drizzle Studio (GUI para BD)
```

## 🎨 Personalización

### Cambiar precio por número
Editar en `components/RifasApp.tsx`:
```typescript
const PRICE_PER_NUMBER = 500; // Cambiar valor
```

### Cambiar cantidad de números
Modificar en el esquema de BD y componente:
- `lib/db/schema.ts`: `totalNumbers` default
- `components/RifasApp.tsx`: Grid dimensions

### Cambiar tiempo de reserva
En `components/RifasApp.tsx`:
```typescript
const RESERVATION_TIMEOUT = 15 * 60; // segundos
```

## 🐛 Troubleshooting

### Error de conexión a Turso
- Verificar URL y token en `.env.local`
- Verificar que la BD existe: `turso db list`

### MercadoPago no redirige
- Verificar Access Token válido
- Verificar URLs de retorno configuradas

### Build falla en Vercel
- Verificar todas las variables de entorno
- Revisar logs en Vercel Dashboard

## 📊 Panel de Administración

Acceder desde la app principal:
1. Click en botón "Admin" en header
2. Ver métricas de ventas
3. Lista de compras recientes
4. Exportar datos (próximamente)

## 🔒 Seguridad

- Variables de entorno nunca en el código
- Webhooks con verificación de firma
- Validación de datos con Zod
- Transacciones atómicas en BD
- Rate limiting en APIs (configurable)

## 📧 Soporte

Para problemas o consultas:
- Abrir un [issue en GitHub](https://github.com/roddb/sistema-ventas-rifas/issues)
- Email: soporte@colegio.edu.ar

## 📄 Licencia

MIT - Ver archivo LICENSE

---

Desarrollado con ❤️ para el evento escolar 2024