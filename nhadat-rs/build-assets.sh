#!/usr/bin/env bash
# Build Tailwind CSS (standalone CLI, no Node). Run from anywhere.
# Install CLI once: curl -sL -o ~/.local/bin/tailwindcss \
#   https://github.com/tailwindlabs/tailwindcss/releases/download/v4.3.0/tailwindcss-linux-x64 && chmod +x ~/.local/bin/tailwindcss
set -euo pipefail
cd "$(dirname "$0")"
TW="${TAILWINDCSS:-$(command -v tailwindcss || echo "$HOME/.local/bin/tailwindcss")}"
[ -x "$TW" ] || { echo "tailwindcss binary not found (set TAILWINDCSS=...)" >&2; exit 1; }
mkdir -p static/css
timeout -k 5 120 "$TW" -i assets/app.css -o static/css/app.css --minify
echo "built static/css/app.css ($(wc -c < static/css/app.css) bytes)"
