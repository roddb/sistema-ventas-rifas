---
name: save
description: Guarda el estado del proyecto. Actualiza ESTADO.md, BUGS.md, MEMORIA.md y hace commit + push a GitHub.
---

# Comando /save — Sistema de Ventas de Rifas

## INSTRUCCIONES PARA CLAUDE CODE

Cuando el usuario ejecute `/save`, seguí estos pasos EN ORDEN:

---

### PASO 1: Identificar el alcance de revisión

- **Primer /save de la sesión**: revisar TODO desde el inicio de la sesión actual
- **/save subsiguiente**: revisar solo desde el último /save o /inicio

---

### PASO 2: Analizar la conversación

Extraer:
1. Tareas completadas (qué tareas del checklist se terminaron)
2. Tareas en progreso `[~]`
3. Bugs / errores encontrados (con causa raíz si se identificó)
4. Soluciones aplicadas
5. Decisiones de diseño tomadas
6. Archivos modificados (creados/editados/eliminados)
7. Problemas pendientes
8. Insights técnicos sobre Next.js / Drizzle / MercadoPago / Vercel

---

### PASO 3: Actualizar ESTADO.md

1. Actualizar fecha de última sesión
2. Marcar `[x]` en tareas completadas, `[~]` en las en progreso
3. Agregar entrada a la Bitácora:

```markdown
### YYYY-MM-DD — Save #N
- **Tareas completadas**: [lista]
- **En progreso**: [si hay]
- **Próxima tarea**: [número y descripción]
- **Archivos modificados**: [lista]
- **Notas**: [observaciones relevantes]
```

---

### PASO 4: Actualizar BUGS.md

Para cada bug nuevo o cambio de estado:

```markdown
### BUG-NNN | RESUELTO | PENDIENTE
- **Fecha detectado**: YYYY-MM-DD
- **Descripción**: [qué pasó]
- **Contexto**: [tarea/archivo donde se presentó]
- **Error/Síntoma**: [mensaje observado]
- **Causa raíz**: [por qué pasó]
- **Solución aplicada**: [qué se hizo]
- **Archivos afectados**: [lista]
- **Fecha resuelto**: [fecha o "Pendiente"]

---
```

Notas:
- Numerar secuencialmente (siguiente número disponible). El histórico está en BUG-H001 a BUG-H005.
- Actualizar el resumen del header (Total/Resueltos/Pendientes)
- Si no hubo bugs, no agregar nada

---

### PASO 5: Actualizar MEMORIA.md

1. Actualizar "Último save" en el header
2. Reescribir "Contexto Actual" con el estado actual (en 1-2 párrafos)
3. Agregar nuevas decisiones de diseño si las hubo
4. Actualizar Stack Técnico si cambió algo
5. Agregar sesión al Historial:

```markdown
### Sesión N — YYYY-MM-DD
- **Resumen**: [2-3 líneas]
- **Logros**: [lista]
- **Problemas encontrados**: [referencia a BUGS.md si los hubo]
- **Estado al cerrar**: [en qué quedó]
```

---

### PASO 6: Commit + Push a GitHub

```bash
if [ ! -d ".git" ]; then
  echo "NO_GIT_REPO — saltar push"
else
  git add -A
  # Mensaje según contenido:
  # - tareas: "save: completadas tareas X.Y a Z.W - YYYY-MM-DD HH:MM"
  # - bug: "save: fix BUG-NNN [breve] - YYYY-MM-DD HH:MM"
  # - mixto: "save: tareas X.Y-Z.W + fix BUG-NNN - YYYY-MM-DD HH:MM"
  # - solo estado: "save: actualización de estado - YYYY-MM-DD HH:MM"
  git commit -m "save: [descripción] - $(date +%Y-%m-%d\ %H:%M)"
  BRANCH=$(git branch --show-current)
  git push origin $BRANCH
fi
```

> El hook `pre-commit-gate.sh` chequea conflict markers, `\n` literal, secretos y archivos pesados antes de aceptar el commit.

---

### PASO 7: Confirmar al usuario

```
💾 Save completado

📋 ESTADO.md actualizado:
   ✅ Tareas completadas: [lista]
   🔄 En progreso: [si hay]
   🎯 Próxima: [tarea]

🐛 BUGS.md: [N nuevos / sin cambios]
   [BUG-NNN brevemente si hubo]

🧠 MEMORIA.md: Sesión N registrada

📤 Git:
   ✅ Commit: "save: [mensaje]"
   ✅ Push a [branch]
```

---

## REGLAS IMPORTANTES

1. SEGUIR el orden 1-7
2. SIEMPRE intentar commit + push (Paso 6)
3. NUNCA hacer push sin haber actualizado los 3 archivos antes
4. `git add -A` toma TODOS los archivos modificados, no solo de control
5. Si push falla → informar al usuario con el error específico
6. Si no hay repo Git → guardar archivos y avisar
7. Mensajes de commit en formato Conventional Commits (`save:`, `fix:`, `feat:`, etc.)
8. Revisar SOLO desde el último /save (no releer todo)
9. Si la sesión incluyó cambios al flujo de pago o concurrencia: agregar a Notas en la bitácora "requiere re-test de concurrencia / smoke test sandbox MP"
