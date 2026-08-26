#!/usr/bin/env bash
#
# Optimize wizard screenshots in place.
#
# Wizard steps embed screenshots that ship inside the Keycloak extension JAR, which lands
# in every Keycloak image — so an unoptimized 3 MB screen capture is paid for on every
# pull, not just by the browser. Straight from a Retina screenshot these run 2-3 MB each;
# this pipeline gets them to roughly a tenth of that with no visible difference at the
# size they are actually displayed.
#
# Three passes, in order:
#   1. downscale so neither side exceeds MAX_DIM (only ever shrinks)
#   2. pngquant  — lossy palette reduction, the bulk of the win
#   3. oxipng    — lossless recompression of what is left
#
# Safe to re-run: the resize only shrinks, pngquant skips when it cannot improve, and
# oxipng is lossless. Re-running does re-quantize, so avoid doing so repeatedly on the
# same file for no reason.
#
# Logo directories are skipped: they are brand assets, already small, and palette
# reduction can band a gradient in a way nobody notices until it ships.
#
# Usage:  pnpm optimize:screenshots [path]
#         MAX_DIM=1600 QUALITY=70-95 pnpm optimize:screenshots
set -euo pipefail

MAX_DIM="${MAX_DIM:-1400}"
QUALITY="${QUALITY:-65-90}"
TARGET="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/wizards}"

for tool in magick pngquant oxipng; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found." >&2
    echo "  brew install imagemagick pngquant oxipng" >&2
    exit 1
  fi
done

if [ ! -d "$TARGET" ]; then
  echo "error: no such directory: $TARGET" >&2
  exit 1
fi

echo "Optimizing PNGs under $TARGET (max ${MAX_DIM}px, quality ${QUALITY})"

total_before=0
total_after=0
count=0

while IFS= read -r -d '' file; do
  before=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")

  magick "$file" -resize "${MAX_DIM}x${MAX_DIM}>" "$file"
  pngquant --quality="$QUALITY" --skip-if-larger --strip --force --output "$file" "$file" 2>/dev/null || true
  oxipng -o 4 --strip safe --quiet "$file" || true

  after=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  total_before=$((total_before + before))
  total_after=$((total_after + after))
  count=$((count + 1))
done < <(find "$TARGET" -type f -name '*.png' -not -path '*logos*' -print0)

if [ "$count" -eq 0 ]; then
  echo "No PNGs found."
  exit 0
fi

awk -v n="$count" -v b="$total_before" -v a="$total_after" 'BEGIN {
  printf "\n%d file(s): %.1f MB -> %.1f MB (%.1fx smaller, %.1f MB saved)\n",
    n, b/1048576, a/1048576, (a>0 ? b/a : 0), (b-a)/1048576
}'
