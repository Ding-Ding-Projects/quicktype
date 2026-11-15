#!/usr/bin/env bash
# Builds the quicktype Studio appliance images with LinuxKit.
#   appliance/build.sh <studio-image-ref> [output-dir]
# Needs: git, go, docker. Component versions come from LinuxKit's own
# examples/minimal.yml at LINUXKIT_REF so they always form a tested set.
set -euo pipefail
STUDIO_IMAGE="${1:?usage: build.sh <studio image ref> [out dir]}"
OUT="${2:-appliance-out}"
LINUXKIT_REF="${LINUXKIT_REF:-v1.8.2}"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "==> Fetching LinuxKit ${LINUXKIT_REF}"
git clone --depth 1 --branch "$LINUXKIT_REF" https://github.com/linuxkit/linuxkit "$work/linuxkit"
echo "==> Building the linuxkit CLI"
(cd "$work/linuxkit/src/cmd/linuxkit" && go build -o "$work/linuxkit-cli" .)

minimal="$work/linuxkit/examples/minimal.yml"
pick() { grep -Eho "linuxkit/$1:[0-9a-f.v-]+" "$minimal" "$work/linuxkit/examples/"*.yml | head -1; }
KERNEL="$(grep -Eo 'linuxkit/kernel:[^ "]+' "$minimal" | head -1)"
declare -A IMG
for c in init runc containerd ca-certificates sysctl dhcpcd getty rngd; do
  ref="$(pick "$c")"
  [ -n "$ref" ] || { echo "could not find linuxkit/$c in the pinned examples" >&2; exit 1; }
  IMG[$c]="$ref"
done

mkdir -p "$OUT"
sed -e "s#@KERNEL@#${KERNEL}#" \
    -e "s#@INIT@#${IMG[init]}#" -e "s#@RUNC@#${IMG[runc]}#" -e "s#@CONTAINERD@#${IMG[containerd]}#" \
    -e "s#@CA_CERTIFICATES@#${IMG[ca-certificates]}#" -e "s#@SYSCTL@#${IMG[sysctl]}#" -e "s#@DHCPCD@#${IMG[dhcpcd]}#" \
    -e "s#@GETTY@#${IMG[getty]}#" -e "s#@RNGD@#${IMG[rngd]}#" -e "s#@STUDIO_IMAGE@#${STUDIO_IMAGE}#" \
    "$here/quicktype-appliance.template.yml" > "$OUT/quicktype-appliance.yml"
if grep -q '@[A-Z_]*@' "$OUT/quicktype-appliance.yml"; then echo "unfilled placeholder in the image recipe" >&2; exit 1; fi

echo "==> Building images"
"$work/linuxkit-cli" build --docker --format raw-bios --format iso-efi --dir "$OUT" --name quicktype-appliance "$OUT/quicktype-appliance.yml"
ls -la "$OUT"
(cd "$OUT" && sha256sum quicktype-appliance* > SHA256SUMS)
echo "==> Done. Images are in $OUT"
