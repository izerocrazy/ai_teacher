#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[ai-teacher] Node.js is required but was not found."
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "[ai-teacher] Installing frontend dependencies..."
  npm --prefix frontend install
fi

cleanup() {
  echo
  echo "[ai-teacher] Stopping services..."
  if [ -n "${BACKEND_PID:-}" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "[ai-teacher] Starting backend: http://127.0.0.1:8010"
npm run dev:backend &
BACKEND_PID=$!

sleep 1

echo "[ai-teacher] Starting frontend: http://127.0.0.1:5173"
npm run dev:frontend &
FRONTEND_PID=$!

echo
echo "[ai-teacher] Ready. Open http://127.0.0.1:5173"
echo "[ai-teacher] Press Ctrl+C to stop both services."

wait "$BACKEND_PID" "$FRONTEND_PID"
