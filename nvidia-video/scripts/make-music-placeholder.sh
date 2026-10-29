#!/usr/bin/env bash
# Generates a 60 s ambient pad as a PLACEHOLDER music bed (A-minor drone + slow pulse).
# Replace public/audio/music-placeholder.mp3 with a licensed track before publishing.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error \
  -f lavfi -i "sine=f=110:d=60" -f lavfi -i "sine=f=164.81:d=60" -f lavfi -i "sine=f=220:d=60" \
  -f lavfi -i "sine=f=261.63:d=60" -f lavfi -i "sine=f=329.63:d=60" -f lavfi -i "anoisesrc=d=60:c=pink:a=0.02" \
  -filter_complex "[0]volume=0.5[a0];[1]volume=0.25[a1];[2]volume=0.3,tremolo=f=0.25:d=0.6[a2];[3]volume=0.18,tremolo=f=0.17:d=0.7[a3];[4]volume=0.12,tremolo=f=0.5:d=0.8[a4];[5]lowpass=f=900[n];\
[a0][a1][a2][a3][a4][n]amix=inputs=6:normalize=0,lowpass=f=2200,aecho=0.8:0.85:600|1100:0.35|0.25,afade=t=in:d=3,afade=t=out:st=56:d=4,volume=0.9,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000" \
  -c:a libmp3lame -b:a 160k public/audio/music-placeholder.mp3
echo "wrote public/audio/music-placeholder.mp3"
