---
name: autoaprendizaje
description: Captura aprendizajes de la sesión en LEARNINGS.md y promueve reglas operativas a CLAUDE.md.
---

# Comando /autoaprendizaje — Sistema de Ventas de Rifas

## Objetivo
Revisar las acciones y decisiones de la sesión, identificar mejoras concretas, y aplicarlas en el lugar correcto (LEARNINGS.md, CLAUDE.md "Reglas aprendidas", o un command específico).

---

## Paso 1: Verificar infraestructura

### LEARNINGS.md
Si NO existe, crearlo con:
```markdown
# Aprendizajes del proyecto

> Generado y mantenido por `/autoaprendizaje`.

## Registro de aprendizajes
```

### CLAUDE.md
Verificar que tiene sección `## Reglas aprendidas`. Si no, agregarla al final.

---

## Paso 2: Recopilar fuentes

Leer en este orden:
1. Historial de conversación desde el último `/autoaprendizaje` o `/inicio`
2. MEMORIA.md (decisiones, contexto)
3. ESTADO.md (tareas completadas, bitácora)
4. BUGS.md (bugs nuevos/resueltos)
5. LEARNINGS.md (no duplicar)
6. CLAUDE.md (no contradecir reglas existentes)

---

## Paso 3: Análisis

Identificar mejoras en:

### A. Errores recurrentes / evitables
Bugs que podrían prevenirse con una regla. Ejemplos del dominio rifas:
- Olvidar `dynamic = 'force-dynamic'` en API route nueva → regla para CLAUDE.md
- Hardcodear precios o totales → regla
- Usar callback URL como fuente de verdad de pago → regla

### B. Flujos ineficientes
- Re-trabajo evitable
- Pasos extra innecesarios
- Ida y vuelta con el usuario

### C. Decisiones de herramientas
- ¿Drizzle Studio vs turso-cloud MCP?
- ¿Vercel CLI vs MCP?
- ¿Test manual vs `node run-concurrency-test.js`?

### D. Convenciones del usuario
- Preferencias de formato
- Orden de operaciones esperado
- Nivel de detalle deseado en commits

---

## Paso 4: Determinar destino

### Nivel 1 → Solo registro en LEARNINGS.md
Aprendizaje informativo, no cambia comportamiento general.
Ejemplo: "El SDK de MercadoPago 2.0.15 tiene un bug conocido en el método X — workaround documentado".

### Nivel 2 → Regla nueva en CLAUDE.md ("Reglas aprendidas")
Cambio de comportamiento general, aplica en cualquier contexto.
Ejemplo: "Toda escritura a raffle_numbers va dentro de db.transaction()".

Formato:
```markdown
- **YYYY-MM-DD** [Categoría] — [Regla imperativa]. _(Origen: [caso])_
```

### Nivel 3 → Modificación de un command
Un workflow específico cambia.
Ejemplo: "/test-concurrencia debería también verificar que /api/test/reset-numbers responda 404 en NODE_ENV=production".

**Importante**: para Nivel 3, proponer diff explícito (qué líneas agregar/cambiar/eliminar) antes de aplicar.

---

## Paso 5: Presentar al usuario

```
## Aprendizajes detectados — YYYY-MM-DD

### Cambios propuestos en CLAUDE.md (N reglas nuevas)
1. [Regla]
   - Origen: [caso]
   - Categoría: [error recurrente / flujo / herramienta / convención]

### Cambios propuestos en commands (N modificaciones)
1. Archivo: [save.md / inicio.md / etc]
   - Cambio: [descripción]
   - Origen: [caso]
   - Diff:
     ```
     + línea agregada
     - línea eliminada
     ```

### Solo registro en LEARNINGS.md (N entradas)
1. [Aprendizaje informativo]
   - Origen: [contexto]

¿Aprobás?
- Aprobar todos
- Aprobar con modificaciones (cuáles)
- Reclasificar (Nivel 2 → 3, etc.)
- Descartar (números)
```

**No aplicar nada hasta aprobación explícita.**

---

## Paso 6: Aplicar cambios aprobados

### Nivel 1 (LEARNINGS.md):
```markdown
- **YYYY-MM-DD** [Categoría] — [Descripción]. _(Destino: solo registro)_ _(Origen: [caso])_
```

### Nivel 2 (CLAUDE.md "Reglas aprendidas"):
```markdown
- **YYYY-MM-DD** [Categoría] — [Regla imperativa]. _(Origen: [caso])_
```
Y registrar en LEARNINGS.md:
```markdown
- **YYYY-MM-DD** [Categoría] — [Descripción]. _(Destino: CLAUDE.md)_ _(Origen: [caso])_
```

### Nivel 3 (command):
Aplicar la modificación al `.claude/commands/X.md`.
Y registrar en LEARNINGS.md:
```markdown
- **YYYY-MM-DD** [Categoría] — [Descripción]. _(Destino: X.md)_ _(Origen: [caso])_
```

---

## Paso 7: Cruce de consistencia

1. **Sin contradicciones** — si una regla nueva contradice una existente, señalarlo y pedir resolución
2. **Sin duplicados** — si un aprendizaje ya está, no agregarlo
3. **Comandos coherentes** — releer el .md modificado completo para verificar que el flujo sigue teniendo sentido

---

## Notas

- Complementa a `/save`. `/save` registra QUÉ pasó. `/autoaprendizaje` registra QUÉ SE APRENDIÓ.
- Ejecutable en cualquier momento, no solo al final.
- Si la sesión fue corta o sin aprendizajes significativos, decirlo claramente.
- LEARNINGS.md es el registro maestro: TODO aprendizaje queda ahí, independientemente de si también fue a CLAUDE.md o a un command.
- Cambios Nivel 3 requieren commit posterior (`/save`).
