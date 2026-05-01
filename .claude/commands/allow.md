---
description: Revisa los logs de la sesión de hoy y agrega las herramientas usadas como permitidas en .claude/settings.local.json (sin reemplazar las existentes)
allowed-tools: Bash, Read, Write
---

Analizá los logs de Claude Code del día de hoy para este proyecto y agregá las herramientas usadas como reglas `allow` en `.claude/settings.local.json`. **No reemplaces nada: solo mergea nuevas reglas a las existentes.**

## Pasos

### 1. Encontrar el directorio de logs

```bash
echo "-$(pwd | sed 's|/|-|g' | sed 's/^-//')"
ls ~/.claude/projects/$(echo "-$(pwd | sed 's|/|-|g' | sed 's/^-//')")/*.jsonl 2>/dev/null
```

### 2. Extraer tool_use del día de hoy

```bash
python3 << 'EOF'
import json, os
from datetime import date
from pathlib import Path

cwd = os.getcwd()
today = date.today().isoformat()
encoded = "-" + cwd.replace("/", "-").lstrip("-")
logs_dir = Path.home() / ".claude" / "projects" / encoded

if not logs_dir.exists():
    print(f"NO_LOGS_DIR:{logs_dir}")
    exit(0)

tool_uses = []
for jf in logs_dir.glob("*.jsonl"):
    for line in jf.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip() or today not in line:
            continue
        try:
            obj = json.loads(line)
            if obj.get("timestamp", "")[:10] != today:
                continue
            for item in obj.get("message", {}).get("content", []):
                if isinstance(item, dict) and item.get("type") == "tool_use":
                    tool_uses.append({"name": item["name"], "input": item.get("input", {})})
        except:
            pass

print(f"TOTAL:{len(tool_uses)}")
for tu in tool_uses:
    print(f"TOOL:{json.dumps(tu)}")
EOF
```

### 3. Generar reglas

- **Bash**: 1-2 primeras palabras + `*`. Ej: `npm run db:studio` → `Bash(npm run *)`. NUNCA generar reglas para `rm -rf`, `dd`, `chmod 777`, `sudo`, etc.
- **Read/Edit/Write**: directorio padre + wildcard. `./lib/services/raffleService.ts` → `Read(./lib/services/*)`
- **Glob/Grep/LS/WebFetch/WebSearch**: `Tool(*)`
- **Herramientas MCP** (`mcp__*`): agregar la específica + el wildcard del servidor (`mcp__turso-cloud__execute_query` y `mcp__turso-cloud__*`)
- **Herramientas críticas para este proyecto**: las MCP de `turso-cloud`, `vercel`, `mercadopago` (si existe), `context7`, `github` se permiten con prioridad

### 4. Mergear en .claude/settings.local.json

Leer el archivo (si no existe, empezar con `{}`).

Agregar reglas nuevas a `permissions.allow` SIN duplicar.

Mantener `permissions.deny` y `permissions.ask` intactos.

Escribir con indentación de 2 espacios.

### 5. Resumen

Mostrar:
- Cantidad de tool_use encontrados hoy
- Reglas nuevas agregadas (con `+`)
- Reglas que ya existían (no duplicadas)
- Path actualizado
- Contenido final de `permissions.allow`

Si no hay logs del día o el directorio no existe, informar sin error.
