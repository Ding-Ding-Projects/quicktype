#!/usr/bin/env bash
# Fetches everything needed to build, run and test quicktype Studio on Linux or macOS.
# Installs in user scope only. Re-running is safe.
set -euo pipefail
cd "$(dirname "$0")"
NODE_VER=24.6.0
TOOLS="${XDG_DATA_HOME:-$HOME/.local/share}/quicktype-studio/tools"
echo "[1/3] Node.js"
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then
  echo "    using $(command -v node) ($(node -v))"
else
  os=$(uname -s | tr '[:upper:]' '[:lower:]'); arch=$(uname -m); [ "$arch" = x86_64 ] && arch=x64; [ "$arch" = aarch64 ] && arch=arm64
  name="node-v${NODE_VER}-${os}-${arch}.tar.xz"; base="https://nodejs.org/dist/v${NODE_VER}"
  mkdir -p "$TOOLS"; curl -fsSL "$base/$name" -o "$TOOLS/$name"
  want=$(curl -fsSL "$base/SHASUMS256.txt" | grep " $name\$" | cut -d' ' -f1)
  got=$(sha256sum "$TOOLS/$name" | cut -d' ' -f1)
  [ "$want" = "$got" ] || { echo "digest mismatch for $name" >&2; exit 1; }
  tar -xJf "$TOOLS/$name" -C "$TOOLS" && rm "$TOOLS/$name"
  export PATH="$TOOLS/${name%.tar.xz}/bin:$PATH"
  echo "    installed and verified $TOOLS/${name%.tar.xz}"
fi
echo "[2/3] Engine packages"; npm ci --no-audit --no-fund
echo "[3/3] Studio and website packages"; (cd studio && npm ci --no-audit --no-fund); (cd site && npm ci --no-audit --no-fund)
echo "All dependencies are ready."
