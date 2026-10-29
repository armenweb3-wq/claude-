#!/usr/bin/env bash
# Renders the three education films at 1920x1080 and masters the audio to -14 LUFS.
set -euo pipefail
cd "$(dirname "$0")/.."
for comp in Edu1-AccountBasics Edu2-OrdersMarketTypes Edu3-AdvancedStrategies; do
  npx remotion render src/index.ts "$comp" "out/$comp.raw.mp4" --codec h264 --crf 18 --audio-codec aac --audio-bitrate 320k --log=error
  ffmpeg -y -loglevel error -i "out/$comp.raw.mp4" -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 256k -ar 48000 -movflags +faststart "out/$comp.mp4"
  rm "out/$comp.raw.mp4"
  echo "done $comp"
done
