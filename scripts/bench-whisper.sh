#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${REPO_ROOT}/resources/whisper/whisper-server"
LIB_DIR="${REPO_ROOT}/resources/whisper/lib"
MODEL_DIR="${REPO_ROOT}/resources/whisper/models"
PORT=8179  # avoid clash with running app

MODELS=(
  "ggml-large-v3-turbo.bin"
  "ggml-large-v3-turbo-q5_0.bin"
)

WAV_FILES=(
  "/tmp/bench_en.wav"
  "/tmp/bench_da.wav"
)

ROUNDS=5

# ── Helpers ───────────────────────────────────────────────────────

wait_for_server() {
  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    if curl -s "http://127.0.0.1:${PORT}/" > /dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "ERROR: server did not start within 60s" >&2
  return 1
}

transcribe() {
  local wav="$1"
  local lang="$2"
  curl -s -X POST "http://127.0.0.1:${PORT}/inference" \
    -F "file=@${wav}" \
    -F "response_format=json" \
    -F "temperature=0.0" \
    -F "language=${lang}"
}

time_ms() {
  python3 -c "import time; print(int(time.time()*1000))"
}

kill_server() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}

trap kill_server EXIT

# ── Benchmark ─────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Whisper Model Benchmark  ($ROUNDS rounds each)           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

for model in "${MODELS[@]}"; do
  model_path="${MODEL_DIR}/${model}"
  if [ ! -f "$model_path" ]; then
    echo "⚠️  Skipping $model (file not found)"
    continue
  fi

  model_size=$(du -h "$model_path" | cut -f1 | xargs)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Model: $model ($model_size)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Start server and time model load
  load_start=$(time_ms)

  DYLD_LIBRARY_PATH="$LIB_DIR" "$SERVER" \
    -m "$model_path" \
    --port "$PORT" \
    --host 127.0.0.1 \
    -l auto \
    -t 8 \
    -bo 1 \
    --no-timestamps \
    -nf \
    -sns \
    > /dev/null 2>&1 &
  SERVER_PID=$!

  wait_for_server
  load_end=$(time_ms)
  load_time=$(( load_end - load_start ))
  echo "⏱  Model load time: ${load_time}ms"
  echo ""

  # Warm-up request (first request after load is sometimes slower)
  transcribe "${WAV_FILES[0]}" "auto" > /dev/null 2>&1

  for wav in "${WAV_FILES[@]}"; do
    wav_name=$(basename "$wav" .wav)
    lang="auto"
    echo "  🎤 File: $wav_name (lang=$lang)"

    total=0
    text=""
    for i in $(seq 1 $ROUNDS); do
      t0=$(time_ms)
      result=$(transcribe "$wav" "$lang")
      t1=$(time_ms)
      elapsed=$(( t1 - t0 ))
      total=$(( total + elapsed ))
      text=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','').strip())" 2>/dev/null || echo "$result")
      printf "     Round %d: %4dms\n" "$i" "$elapsed"
    done

    avg=$(( total / ROUNDS ))
    echo "     ────────────────"
    printf "     Average: %4dms\n" "$avg"
    echo "     Output:  \"$text\""
    echo ""
  done

  kill_server
  sleep 1  # let port free up
done

echo "✅ Benchmark complete!"
