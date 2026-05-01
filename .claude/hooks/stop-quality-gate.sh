#!/usr/bin/env bash
# Hook Stop — Quality gate antes de cerrar sesión.
# Bloquea (exit 2) si npm run lint o npm run build fallan.
# CRITICAL: respeta stop_hook_active para evitar loops infinitos.
#
# Origen: adaptado de Intellego Platform/.claude/hooks/stop-quality-gate.sh.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# Skip si no hay package.json o no hay node_modules
if [ ! -f package.json ]; then
  exit 0
fi
if [ ! -d node_modules ]; then
  echo "⚠ node_modules no instalado — saltando quality gate. Correr 'npm install'." >&2
  exit 0
fi

ERRORS=""

# Lint
LINT_OUTPUT=$(npm run lint 2>&1) || {
  ERRORS="LINT ERRORS:
$(echo "$LINT_OUTPUT" | tail -20)
"
}

# Build (TypeScript strict + Next.js)
BUILD_OUTPUT=$(npm run build 2>&1) || {
  ERRORS="${ERRORS}BUILD ERRORS:
$(echo "$BUILD_OUTPUT" | tail -25)
"
}

if [ -n "$ERRORS" ]; then
  echo "Quality gate failed. Fix before finishing:" >&2
  echo "$ERRORS" >&2
  exit 2
fi

# Warnings no-bloqueantes
WARNINGS=""
MODIFIED=$(git status --porcelain 2>/dev/null | grep -v "^??" | head -20)
if [ -n "$MODIFIED" ]; then
  COUNT=$(echo "$MODIFIED" | wc -l | tr -d ' ')
  WARNINGS="${WARNINGS}
• $COUNT archivo(s) modificado(s) sin commitear. Usá /save."
fi

if [ -n "$MODIFIED" ] && [ -f ESTADO.md ]; then
  ESTADO_MTIME=$(stat -f %m ESTADO.md 2>/dev/null || stat -c %Y ESTADO.md 2>/dev/null || echo 0)
  MOST_RECENT_CHANGE=$(git status --porcelain 2>/dev/null | awk '{print $NF}' | \
    xargs -I {} stat -f %m {} 2>/dev/null | sort -nr | head -1 || echo 0)
  if [ "$MOST_RECENT_CHANGE" -gt "$ESTADO_MTIME" ] 2>/dev/null; then
    WARNINGS="${WARNINGS}
• ESTADO.md desactualizado respecto a archivos modificados. Considerá /save."
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo "⚠ Quality gate — cierre de sesión:$WARNINGS" >&2
fi

exit 0
