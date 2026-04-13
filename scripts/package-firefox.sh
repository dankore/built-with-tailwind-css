#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
BUILD_DIR="$ROOT_DIR/build"
MANIFEST_FILE="$SRC_DIR/manifest.firefox.json"

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "Missing $MANIFEST_FILE"
  exit 1
fi

VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$MANIFEST_FILE")"
OUT_ZIP="$BUILD_DIR/built-with-tailwind-css-firefox-${VERSION}.zip"
STAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

mkdir -p "$BUILD_DIR"
rm -f "$OUT_ZIP"

rsync -a \
  --exclude=".DS_Store" \
  --exclude="manifest.firefox.json" \
  --exclude="*.zip" \
  "$SRC_DIR/" "$STAGE_DIR/"

cp "$MANIFEST_FILE" "$STAGE_DIR/manifest.json"

(cd "$STAGE_DIR" && zip -r "$OUT_ZIP" .)

echo "Created $OUT_ZIP"
