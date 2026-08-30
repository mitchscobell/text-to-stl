#!/usr/bin/env bash
#
# scripts/docker-smoke-test.sh
#
# Builds the Docker image and verifies the container starts and serves traffic.
#
# Usage:
#   bash scripts/docker-smoke-test.sh
#   npm run test:docker

set -euo pipefail

IMAGE="text-to-stl:smoke-test"
CONTAINER="text-to-stl-smoke-$$"
PORT=8081
MAX_WAIT=120

# ─── Cleanup ─────────────────────────────────────────────────────────────────

cleanup() {
  local exit_code=$?
  echo ""
  echo "--- Cleaning up ---"
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker rmi -f "$IMAGE"    2>/dev/null || true
  if [ $exit_code -ne 0 ]; then
    echo ""
    echo "=== Container logs at time of failure ==="
    docker logs "$CONTAINER" 2>/dev/null || true
  fi
  exit $exit_code
}
trap cleanup EXIT

# ─── Requirements ────────────────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP: Docker not available – skipping smoke test."
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "SKIP: curl not available – skipping smoke test."
  exit 0
fi

# ─── Build ───────────────────────────────────────────────────────────────────

echo "--- Building image (--no-cache) ---"
docker build --no-cache -t "$IMAGE" .

# ─── Start ───────────────────────────────────────────────────────────────────

echo "--- Starting container on port $PORT ---"
docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:3000" \
  "$IMAGE"

# ─── Wait for /version.json ─────────────────────────────────────────────────

echo "--- Waiting for /version.json (up to ${MAX_WAIT}s) ---"
elapsed=0
until curl -sf "http://localhost:$PORT/version.json" >/dev/null 2>&1; do
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "FAIL: container did not become healthy within ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  echo "  ... waited ${elapsed}s"
done

# ─── Assert /version.json ───────────────────────────────────────────────────

echo "--- Asserting /version.json ---"
VERSION_BODY=$(curl -sf "http://localhost:$PORT/version.json")
echo "  Response: $VERSION_BODY"

if ! echo "$VERSION_BODY" | grep -q '"version"'; then
  echo "FAIL: /version.json did not contain a version field"
  exit 1
fi

# ─── Assert GET / (main page) ───────────────────────────────────────────────

echo "--- Asserting GET / ---"
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/")
if [ "$HOME_CODE" != "200" ]; then
  echo "FAIL: GET / returned HTTP $HOME_CODE (expected 200)"
  exit 1
fi
echo "  HTTP $HOME_CODE OK"

# ─── Assert index.html contains the app ─────────────────────────────────────

echo "--- Asserting index.html contains app content ---"
HOME_BODY=$(curl -sf "http://localhost:$PORT/")
if ! echo "$HOME_BODY" | grep -q "Text to STL"; then
  echo "FAIL: index.html does not contain 'Text to STL'"
  exit 1
fi
echo "  Content OK"

# ─── Assert JS bundle is served ─────────────────────────────────────────────

echo "--- Asserting JS bundle is served ---"
JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/index.js")
if [ "$JS_CODE" != "200" ]; then
  echo "FAIL: GET /index.js returned HTTP $JS_CODE (expected 200)"
  exit 1
fi
echo "  HTTP $JS_CODE OK"

# ─── Assert /version page ───────────────────────────────────────────────────

echo "--- Asserting GET /version ---"
VER_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/version")
if [ "$VER_CODE" != "200" ]; then
  echo "FAIL: GET /version returned HTTP $VER_CODE (expected 200)"
  exit 1
fi
echo "  HTTP $VER_CODE OK"

# ─── All clear ───────────────────────────────────────────────────────────────

echo ""
echo "=== PASS: all smoke tests passed ==="
