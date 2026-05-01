#!/usr/bin/env bash
# Hook PreToolUse sobre Bash (git commit*) — Pre-commit quality gate.
# Bloquea el commit si detecta problemas comunes en los archivos staged.
#
# Checks (rifas):
#   1. No hay "\n" literal en archivos .md staged (no-meta)
#   2. No hay conflict markers de git ("<<<<<<<", "=======", ">>>>>>>")
#   3. No se commitean .env / .env.local / .env.production
#   4. No se commitean archivos binarios pesados >5MB sin confirmación
#   5. No se commitea node_modules ni .next ni drizzle/meta/* generados
#
# Exit 2 bloquea el commit con stderr visible.
# Origen: adaptado de PAIDEIA/.claude/hooks/pre-commit-gate.sh + Intellego.

set -o pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

ERRORS=""

STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)

if [ -z "$STAGED" ]; then
  exit 0
fi

# Check 1 — "\n" literal en .md de contenido (no en meta-docs)
META_DOCS_REGEX='^(CLAUDE|ESTADO|MEMORIA|BUGS|LEARNINGS|README|TUTORIAL_.*|INTEGRACION_.*|TEST_.*|Historial)\.md$'

while IFS= read -r file; do
  if [ -f "$file" ] && [[ "$file" == *.md ]]; then
    BASENAME=$(basename "$file")
    if [[ "$BASENAME" =~ $META_DOCS_REGEX ]]; then
      continue
    fi
    # .claude/commands/ y .claude/agents/ son meta-docs operativos:
    # documentan el funcionamiento de hooks y workflows, y legitimamente
    # contienen "\n" en backticks como referencia textual.
    if [[ "$file" == .claude/commands/* ]] || [[ "$file" == .claude/agents/* ]]; then
      continue
    fi
    if grep -l '\\n' "$file" 2>/dev/null | head -1 > /dev/null; then
      MATCHES=$(grep -c '\\n' "$file" 2>/dev/null || echo 0)
      ERRORS="${ERRORS}
\\n LITERAL detectado en $file ($MATCHES ocurrencias)."
    fi
  fi
done <<< "$STAGED"

# Check 2 — conflict markers
while IFS= read -r file; do
  if [ -f "$file" ]; then
    if grep -lE '^(<<<<<<<|=======|>>>>>>>) ' "$file" 2>/dev/null | head -1 > /dev/null; then
      ERRORS="${ERRORS}
CONFLICT MARKER sin resolver en $file."
    fi
  fi
done <<< "$STAGED"

# Check 3 — secretos (.env*)
while IFS= read -r file; do
  BASENAME=$(basename "$file")
  if [[ "$BASENAME" == ".env" ]] || [[ "$BASENAME" == ".env.local" ]] || [[ "$BASENAME" == ".env.production" ]]; then
    ERRORS="${ERRORS}
SECRETO STAGED: $file. Revisá .gitignore. NUNCA commitear credenciales (Turso, MercadoPago)."
  fi
done <<< "$STAGED"

# Check 4 — binarios >5MB
while IFS= read -r file; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
    if [ "$SIZE" -gt 5242880 ] 2>/dev/null; then
      SIZE_MB=$((SIZE / 1048576))
      ERRORS="${ERRORS}
ARCHIVO PESADO: $file (${SIZE_MB}MB). ¿Confirmás commit?"
    fi
  fi
done <<< "$STAGED"

# Check 5 — paths que NO deberían commitearse
while IFS= read -r file; do
  case "$file" in
    node_modules/*|.next/*|drizzle/meta/*)
      ERRORS="${ERRORS}
PATH GENERADO en stage: $file. Revisá .gitignore."
      ;;
  esac
done <<< "$STAGED"

if [ -n "$ERRORS" ]; then
  echo "Pre-commit gate FAILED. Revisá antes de commitear:" >&2
  echo "$ERRORS" >&2
  exit 2
fi

exit 0
