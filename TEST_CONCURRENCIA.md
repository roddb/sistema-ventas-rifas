# 🧪 Guía de Pruebas de Concurrencia

## 📋 Descripción

Este sistema incluye pruebas automatizadas para verificar que **NUNCA** se produzca sobreventa de números cuando múltiples usuarios intentan comprar simultáneamente.

## 🚀 Cómo Ejecutar las Pruebas

### Paso 1: Preparar el Entorno

1. **Abrir Terminal 1** - Para el servidor:
```bash
cd "Sistema de ventas de rifas"
npm run dev
```
Espera a que aparezca: `▲ Next.js - Local: http://localhost:3000`

2. **Abrir Terminal 2** - Para monitorear la BD (opcional):
```bash
cd "Sistema de ventas de rifas"
npm run db:studio
```
Esto abrirá Drizzle Studio en `https://local.drizzle.studio`

### Paso 2: Ejecutar las Pruebas

En una **Terminal 3**:
```bash
cd "Sistema de ventas de rifas"
node run-concurrency-test.js
```

## 🎯 Qué Prueban los Tests

### Test 1: Conflicto Directo
- **Escenario**: 2 usuarios intentan comprar el MISMO número (#50) simultáneamente
- **Resultado Esperado**: Solo 1 usuario logra comprarlo
- **Verifica**: Que no hay duplicación de ventas

### Test 2: Conflictos Múltiples
- **Escenario**: 4 usuarios compitiendo por números superpuestos
  - Usuario 1: quiere 100, 101, 102
  - Usuario 2: quiere 101, 102, 103 (conflicto en 101, 102)
  - Usuario 3: quiere 102, 103, 104 (conflicto en 102, 103)
  - Usuario 4: quiere 100, 104, 105 (conflicto en 100, 104)
- **Resultado Esperado**: Cada número se vende UNA sola vez
- **Verifica**: Manejo correcto de múltiples conflictos simultáneos

## 📊 Interpretación de Resultados

### Resultado Exitoso ✅
```
✅ ¡EXCELENTE! No se detectaron conflictos de sobreventa
   Total de números vendidos: 6
   Usuarios exitosos: 2
```
Esto significa que el sistema funcionó correctamente.

### Resultado con Problemas ❌
```
❌ ¡PROBLEMA CRÍTICO! Se detectaron conflictos:
   Número 101 vendido a usuarios 1 y 2
```
Esto indicaría un fallo en la protección contra concurrencia.

## 🔄 Reset Manual de Números

Si necesitas resetear números específicos:

```bash
# Resetear números específicos
curl -X POST http://localhost:3000/api/test/reset-numbers \
  -H "Content-Type: application/json" \
  -d '{"numbers": [50, 100, 101, 102, 103, 104, 105]}'

# Resetear TODOS los números (¡cuidado!)
curl -X POST http://localhost:3000/api/test/reset-numbers \
  -H "Content-Type: application/json" \
  -d '{"resetAll": true}'
```

## 🎬 Prueba Manual en Navegador

Para una prueba más visual:

1. Abre **2 ventanas de navegador** (idealmente en modo incógnito)
2. En ambas, ve a `http://localhost:3000`
3. En ambas, selecciona el **mismo número** (ej: #50)
4. En ambas, haz clic en "Continuar con la compra"
5. Completa los formularios en ambas ventanas
6. Haz clic en "Proceder al Pago" casi simultáneamente

**Resultado esperado**: 
- El primer usuario verá MercadoPago
- El segundo usuario verá un error: "Los números X ya fueron reservados"

## 🔍 Verificar Estado en BD

Después de las pruebas, verifica en Drizzle Studio:

1. Ve a `https://local.drizzle.studio`
2. Revisa la tabla `raffle_numbers`
3. Busca los números de prueba (50, 100-105)
4. Verifica que cada número tenga UN solo `purchaseId`

## ⚠️ Notas Importantes

1. **Solo en Desarrollo**: El endpoint de reset NO funciona en producción
2. **Datos Reales**: Las pruebas crean compras reales en la BD
3. **Limpieza**: Usa el reset para limpiar después de las pruebas
4. **Timing**: Los tests usan delays aleatorios (0-200ms) para simular condiciones reales

## 🐛 Troubleshooting

### "El servidor no está disponible"
- Verifica que `npm run dev` esté corriendo
- Confirma que el puerto 3000 esté libre

### "Error al resetear números"
- Verifica que estés en modo desarrollo
- Confirma que la BD esté accesible

### Los tests pasan pero quiero más certeza
- Ejecuta las pruebas múltiples veces
- Modifica los delays en `test-concurrency.js`
- Aumenta el número de usuarios simultáneos

## 📈 Métricas de Éxito

El sistema es seguro si:
- ✅ Nunca hay sobreventa en 100+ ejecuciones
- ✅ Los errores son claros y descriptivos
- ✅ Los usuarios reciben feedback inmediato
- ✅ La BD mantiene consistencia

---

**Última actualización**: Implementación de protección contra concurrencia completa
**Autor**: Sistema desarrollado con protección anti-sobreventa