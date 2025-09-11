import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Solo crear el cliente si las variables de entorno están disponibles
const client = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : null;

// Si no hay cliente, exportar un objeto vacío que será manejado en los servicios
export const db = client ? drizzle(client, { schema }) : null as any;
export { schema };