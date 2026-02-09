#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_DIR="${ROOT}/.cache/whisper"
WHISPER_DIR="${CACHE_DIR}/whisper.cpp"
MODEL_NAME="${WHISPER_MODEL_NAME:-base.en}"
OUT_DIR="${ROOT}/resources/whisper"
MODEL_DIR="${OUT_DIR}/models"
BUNDLE_MODE="${WHISPER_BUNDLE_MODE:-prebuilt}"

mkdir -p "$CACHE_DIR" "$OUT_DIR" "$MODEL_DIR"

download_model() {
  local model_path="${MODEL_DIR}/ggml-${MODEL_NAME}.bin"
  if [ -f "$model_path" ]; then
    return 0
  fi
  local url="${WHISPER_MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL_NAME}.bin}"
  echo "Downloading model from $url"
  curl -L "$url" -o "$model_path"
}

bundle_prebuilt() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to download the prebuilt whisper.cpp binary." >&2
    return 1
  fi

  local wheel_url
  wheel_url="$(python3 - <<'PY'
import json
import sys
import urllib.request

url = "https://pypi.org/pypi/whisper.cpp-cli/json"
data = json.loads(urllib.request.urlopen(url).read().decode("utf-8"))
version = data["info"]["version"]
files = data["releases"].get(version, [])

def pick_file(tag):
    for f in files:
        if f.get("packagetype") != "bdist_wheel":
            continue
        filename = f.get("filename", "")
        if tag in filename and ("arm64" in filename or "universal2" in filename):
            return f.get("url")
    return None

wheel_url = pick_file("macosx")
if not wheel_url:
    # fallback: try any wheel with arm64/universal2
    for f in files:
        if f.get("packagetype") == "bdist_wheel":
            filename = f.get("filename", "")
            if "arm64" in filename or "universal2" in filename:
                wheel_url = f.get("url")
                break

if not wheel_url:
    sys.exit(1)

print(wheel_url)
PY
)"

  if [ -z "$wheel_url" ]; then
    echo "Unable to locate a macOS arm64 prebuilt whisper.cpp wheel." >&2
    return 1
  fi

  local wheel_path="${CACHE_DIR}/whisper_cpp_cli.whl"
  local extract_dir="${CACHE_DIR}/wheel"
  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"

  echo "Downloading prebuilt whisper.cpp binary from $wheel_url"
  curl -L "$wheel_url" -o "$wheel_path"
  unzip -q -o "$wheel_path" -d "$extract_dir"

  local bin_path
  bin_path="$(find "$extract_dir" -type f -name "whisper-cpp" -perm -111 | head -n 1 || true)"
  if [ -z "$bin_path" ]; then
    bin_path="$(find "$extract_dir" -type f -name "whisper-cli" -perm -111 | head -n 1 || true)"
  fi

  if [ -z "$bin_path" ]; then
    echo "Unable to locate whisper-cpp binary in the wheel." >&2
    return 1
  fi

  cp "$bin_path" "$OUT_DIR/whisper-cli"
  chmod +x "$OUT_DIR/whisper-cli"
  echo "Bundled whisper.cpp -> $OUT_DIR/whisper-cli"
  return 0
}

bundle_from_source() {
  if [ ! -d "$WHISPER_DIR/.git" ]; then
    git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
  else
    git -C "$WHISPER_DIR" pull --ff-only
  fi

  cd "$WHISPER_DIR"

  if ! command -v cmake >/dev/null 2>&1; then
    echo "cmake is required to build whisper.cpp. Install it with: brew install cmake" >&2
    return 1
  fi

  make -j

  local bin=""
  if [ -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
    bin="$WHISPER_DIR/build/bin/whisper-cli"
  elif [ -f "$WHISPER_DIR/main" ]; then
    bin="$WHISPER_DIR/main"
  elif [ -f "$WHISPER_DIR/whisper" ]; then
    bin="$WHISPER_DIR/whisper"
  fi

  if [ -z "$bin" ]; then
    echo "Unable to locate whisper.cpp binary." >&2
    return 1
  fi

  cp "$bin" "$OUT_DIR/whisper-cli"
  chmod +x "$OUT_DIR/whisper-cli"
  echo "Bundled whisper.cpp -> $OUT_DIR/whisper-cli"
  return 0
}

if [ "$BUNDLE_MODE" = "prebuilt" ]; then
  if ! bundle_prebuilt; then
    echo "Falling back to source build..." >&2
    bundle_from_source
  fi
else
  bundle_from_source
fi

download_model

echo "Bundled model -> $MODEL_DIR/ggml-${MODEL_NAME}.bin"
