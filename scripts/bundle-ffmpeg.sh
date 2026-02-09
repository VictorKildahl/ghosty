#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_DIR="${ROOT}/.cache/ffmpeg"
OUT_DIR="${ROOT}/resources/ffmpeg"

FFMPEG_URL_DEFAULT="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/ffmpeg.zip"
FFMPEG_URL="${FFMPEG_DOWNLOAD_URL:-$FFMPEG_URL_DEFAULT}"

mkdir -p "$CACHE_DIR" "$OUT_DIR"

ZIP_PATH="${CACHE_DIR}/ffmpeg.zip"
EXTRACT_DIR="${CACHE_DIR}/extracted"

rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

curl -L "$FFMPEG_URL" -o "$ZIP_PATH"

if command -v unzip >/dev/null 2>&1; then
  unzip -q -o "$ZIP_PATH" -d "$EXTRACT_DIR"
else
  echo "unzip is required to extract ffmpeg." >&2
  exit 1
fi

BIN_PATH=""
if [ -f "$EXTRACT_DIR/ffmpeg" ]; then
  BIN_PATH="$EXTRACT_DIR/ffmpeg"
else
  BIN_PATH=$(find "$EXTRACT_DIR" -type f -name "ffmpeg" -perm -111 | head -n 1 || true)
fi

if [ -z "$BIN_PATH" ]; then
  echo "Unable to locate ffmpeg binary in downloaded archive." >&2
  exit 1
fi

cp "$BIN_PATH" "$OUT_DIR/ffmpeg"
chmod +x "$OUT_DIR/ffmpeg"

echo "Bundled ffmpeg -> $OUT_DIR/ffmpeg"
