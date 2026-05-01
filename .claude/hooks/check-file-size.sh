#!/bin/bash
# Hook PreToolUse para Read: bloquea lectura de archivos grandes sin offset/limit.
# Si el archivo tiene >300 líneas y no se especificó limit, bloquea con mensaje.
#
# Contexto rifas: ESTADO.md, MEMORIA.md, BUGS.md, LEARNINGS.md y los archivos
# en old_docs/ pueden crecer >300 líneas. Forzar lectura en chunks evita
# truncado silencioso por token limit.
#
# Origen: adaptado de Diseño_cuadernillos/.claude/hooks/check-file-size.sh

INPUT=$(cat)

eval "$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
tool_input = d.get('tool_input', d)
fp = tool_input.get('file_path', '')
has_limit = 'yes' if tool_input.get('limit') is not None else 'no'
print(f'FILE_PATH=\"{fp}\"')
print(f'HAS_LIMIT={has_limit}')
" 2>/dev/null)"

if [ -z "$FILE_PATH" ] || [ "$HAS_LIMIT" = "yes" ]; then
  exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

LINES=$(wc -l < "$FILE_PATH" 2>/dev/null | tr -d ' ')

if [ "$LINES" -gt 300 ] 2>/dev/null; then
  echo "ARCHIVO GRANDE: $FILE_PATH tiene $LINES líneas (límite: 300)." >&2
  echo "Usá offset y limit para leer en chunks." >&2
  echo "Ejemplo: Read file_path=\"$FILE_PATH\" limit=300 offset=0" >&2
  exit 2
fi

exit 0
