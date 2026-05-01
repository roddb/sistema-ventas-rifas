---
name: inicio
description: Inicializa o retoma el proyecto Sistema de Ventas de Rifas con sincronización Git automática. Usar al comenzar cada sesión.
---

# Comando /inicio — Sistema de Ventas de Rifas

## INSTRUCCIONES PARA CLAUDE CODE

Cuando el usuario ejecute `/inicio` en este proyecto, seguí estos pasos EN ORDEN:

---

### PASO 0: SINCRONIZACIÓN GIT (siempre primero)

```bash
git fetch origin 2>/dev/null
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse @{u} 2>/dev/null)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "HAY_CAMBIOS_REMOTOS"
else
  echo "ACTUALIZADO"
fi
```

- Si hay cambios remotos → `git pull origin $(git branch --show-current)`
- Si hay conflictos → informar y NO continuar
- Si no hay `.git` → este repo debería tener `https://github.com/roddb/sistema-ventas-rifas` como origin; clonar si es necesario con `gh repo clone roddb/sistema-ventas-rifas .`

Mostrar al usuario:
```
🔄 Sincronización Git
📦 Repo: sistema-ventas-rifas
🌿 Branch: [actual]
[✅ Actualizado / ⚠️ Conflictos / ℹ️ Sin cambios]
```

---

### PASO 1: Cargar contexto en orden

Leer EN ORDEN (usar `Read` con `limit:300, offset:0` y avanzar si hace falta):

| # | Archivo | Qué buscar |
|---|---------|------------|
| 1 | `MEMORIA.md` | Contexto actual, decisiones, stack, última sesión |
| 2 | `ESTADO.md` | Checklist, última tarea completada, próxima tarea, fase actual |
| 3 | `BUGS.md` | Bugs pendientes (sección Pendientes) |
| 4 | `LEARNINGS.md` | Aprendizajes recientes (últimas 2-3 entradas) |
| 5 | `CLAUDE.md` (sección "Reglas aprendidas") | Reglas operativas vigentes |

> Si `ESTADO.md` no existe (proyecto recién clonado), crear los 5 .md a partir de `CLAUDE.md` siguiendo la estructura documentada.

---

### PASO 2: Verificación rápida del entorno

```bash
[ -d node_modules ] && echo "node_modules ✓" || echo "node_modules FALTA — correr npm install"
[ -f .env.local ] && echo ".env.local ✓" || echo ".env.local FALTA"
```

Si la última sesión documentada en MEMORIA.md fue hace >7 días, sugerir:
```
⚠️ Última sesión registrada: [fecha]
Recomendación: correr `npm run lint && npm run build` antes de cualquier cambio.
```

---

### PASO 3: Mostrar briefing al usuario

```
🔄 Retomando: Sistema de Ventas de Rifas

📅 Última sesión: [fecha de MEMORIA.md]
🧠 Contexto actual: [resumen 2-3 líneas]
🎯 Estado: [Fase X.Y — descripción]

📋 Progreso:
   ✅ Completadas: [X de Y tareas en la fase actual]
   🎯 Próxima tarea: [número] - [descripción]

🐛 Bugs pendientes: [cantidad]
   [BUG-NNN brevemente si hay]

⚠️ Reglas críticas relevantes a la próxima tarea:
   [1-2 reglas extraídas de CLAUDE.md]

💡 Comandos: /save /autoaprendizaje /allow /test-concurrencia /deploy-vercel

¿Continuamos con [próxima tarea]?
```

---

### PASO 4: Al COMPLETAR una tarea durante la sesión

Actualizar `ESTADO.md`:
1. Cambiar `[ ]` → `[x]` en la tarea
2. Agregar a la Bitácora si la tarea es significativa:
```markdown
### YYYY-MM-DD - Tarea X.Y completada
- [descripción breve]
- Próxima: X.(Y+1)
```

Confirmar:
```
✅ Tarea X.Y completada
🎯 Próxima: X.(Y+1) — [descripción]

💡 Recordá `/save` cada 3-5 tareas.
```

---

## REGLAS IMPORTANTES

1. SIEMPRE sincronizar Git ANTES de leer archivos
2. SIEMPRE leer los 5 archivos de gestión en orden
3. SIEMPRE extraer 1-2 reglas críticas de CLAUDE.md relevantes a la próxima tarea
4. NUNCA modificar ESTADO/BUGS/MEMORIA/LEARNINGS desde /inicio (eso es /save y /autoaprendizaje)
5. Si la próxima tarea toca pago/concurrencia/schema/deploy: sugerir el agent específico
6. Para archivos >300 líneas: leer en chunks con `limit` y `offset` (forzado por hook check-file-size)
