#!/usr/bin/env bash
# QA contact sheet: renders one still near the end of every scene of a composition.
# Usage: scripts/qa-sheet.sh <CompositionId> <voiceover-json> <out.jpg> [cols] [offset-seconds-before-end]
set -euo pipefail
cd "$(dirname "$0")/.."
COMP=$1; JSON=$2; OUT=$3; COLS=${4:-5}; OFF=${5:-1.5}
FRAMES=$(python3 -c "
import json;d=json.load(open('$JSON'))
print(' '.join(str(int((s['end']-$OFF)*d['fps'])) for s in d['scenes']))")
rm -rf out/stills
COMP=$COMP node scripts/stills.mjs $FRAMES | grep -i error || true
N=$(ls out/stills/*.jpg | wc -l); ROWS=$(( (N + COLS - 1) / COLS ))
ls out/stills/f*.jpg | sed "s/^/file '/;s/$/'/;s#out/stills/##" > out/stills/l.txt
(cd out/stills && ffmpeg -y -loglevel error -f concat -safe 0 -i l.txt -vf "scale=640:-1,tile=${COLS}x${ROWS}:padding=6:color=0x333333" -frames:v 1 "../../$OUT")
echo "$OUT ($N frames)"
