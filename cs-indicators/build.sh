#!/usr/bin/env bash
#
# Compiles a single C# indicator source file to a WebAssembly module.
#
# Usage: build.sh <source.cs> <output-dir>
#
# Requires the .NET SDK with the `wasm-tools` workload:
#   dotnet workload install wasm-tools
#
# The produced module is written to <output-dir>/Indicator.wasm and is expected
# to export: memory, alloc, free, compute, result_len (see SmaIndicator.cs).
set -euo pipefail

SRC="${1:?source file required}"
OUT="${2:?output dir required}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ_DIR="$OUT/proj"

mkdir -p "$PROJ_DIR"
cp "$SRC" "$PROJ_DIR/Indicator.cs"
cp "$ROOT/CsIndicators.csproj" "$PROJ_DIR/CsIndicators.csproj"

dotnet workload install wasm-tools --skip-manifest-update >/dev/null 2>&1 || true
dotnet publish "$PROJ_DIR/CsIndicators.csproj" -c Release -o "$PROJ_DIR/publish" 1>&2

WASM_PATH="$(find "$PROJ_DIR/publish" -name '*.wasm' -print -quit)"
if [[ -z "$WASM_PATH" ]]; then
  echo "No .wasm output produced" 1>&2
  exit 1
fi

cp "$WASM_PATH" "$OUT/Indicator.wasm"
echo "Wrote $OUT/Indicator.wasm" 1>&2
