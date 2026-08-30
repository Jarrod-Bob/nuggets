#!/usr/bin/env bash
# Build the frontend, then embed it in the Go binary. macOS and Linux.
set -euo pipefail

(cd web && npm run build)

mkdir -p internal/web/dist
[ -f internal/web/dist/.gitkeep ] || touch internal/web/dist/.gitkeep

go build -o nuggets ./cmd/nuggets
echo "built nuggets"
