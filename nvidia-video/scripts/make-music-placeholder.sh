#!/usr/bin/env bash
# Generates PLACEHOLDER audio: a 60 s ambient pad (A-minor drone, slow pulse, soft kick),
# a transition whoosh and a low impact hit. Swap the music for a licensed track before publishing.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error \
  -f lavfi -i "sine=f=55:d=61" -f lavfi -i "sine=f=110:d=61" -f lavfi -i "sine=f=164.81:d=61" -f lavfi -i "sine=f=220:d=61" \
  -f lavfi -i "sine=f=261.63:d=61" -f lavfi -i "sine=f=329.63:d=61" -f lavfi -i "anoisesrc=d=61:c=pink:a=0.05" \
  -f lavfi -i "aevalsrc='0.9*sin(2*PI*(45+60*exp(-18*mod(t,1)))*t)*exp(-7*mod(t,1))':d=61" \
  -filter_complex "[0]volume=0.35[a0];[1]volume=0.45[a1];[2]volume=0.25,tremolo=f=0.25:d=0.6[a2];[3]volume=0.28,tremolo=f=0.5:d=0.7[a3];\
[4]volume=0.16,tremolo=f=1:d=0.8[a4];[5]volume=0.12,tremolo=f=2:d=0.9[a5];[6]bandpass=f=1800:w=1200,tremolo=f=4:d=0.5[n];\
[7]lowpass=f=160,volume='if(lt(t,8),0,1)':eval=frame[k];\
[a0][a1][a2][a3][a4][a5][n][k]amix=inputs=8:normalize=0,lowpass=f=4000,aecho=0.8:0.8:500|900:0.3|0.2,\
afade=t=in:d=2.5,afade=t=out:st=56:d=4,loudnorm=I=-16:TP=-1.5,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000" \
  -t 60 -c:a libmp3lame -b:a 192k public/audio/music-placeholder.mp3
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=d=1.1:c=white:a=0.8" \
  -af "highpass=f=300,lowpass=f=6000,volume='0.05+0.95*sin(PI*t/1.1)^3':eval=frame,afade=t=out:st=0.8:d=0.3,aecho=0.6:0.5:120:0.3,pan=stereo|c0=c0|c1=c0" \
  public/audio/whoosh.wav
ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='sin(2*PI*(38+70*exp(-12*t))*t)*exp(-3.2*t)+0.15*random(0)*exp(-30*t)':d=1.6" \
  -af "lowpass=f=900,volume=0.9,pan=stereo|c0=c0|c1=c0" public/audio/impact.wav
echo "wrote public/audio/{music-placeholder.mp3,whoosh.wav,impact.wav}"

# Calm, slower bed for the long "simple" cut (no pulse), 3 minutes so it covers the narration.
ffmpeg -y -loglevel error \
  -f lavfi -i "sine=f=110:d=181" -f lavfi -i "sine=f=164.81:d=181" -f lavfi -i "sine=f=220:d=181" \
  -f lavfi -i "sine=f=277.18:d=181" -f lavfi -i "sine=f=329.63:d=181" \
  -filter_complex "[0]volume=0.4,tremolo=f=0.12:d=0.4[a0];[1]volume=0.25,tremolo=f=0.15:d=0.5[a1];[2]volume=0.22,tremolo=f=0.1:d=0.6[a2];\
[3]volume=0.12,tremolo=f=0.17:d=0.7[a3];[4]volume=0.1,tremolo=f=0.11:d=0.8[a4];\
[a0][a1][a2][a3][a4]amix=inputs=5:normalize=0,lowpass=f=1800,aecho=0.8:0.85:700|1300:0.35|0.25,\
afade=t=in:d=4,afade=t=out:st=175:d=6,loudnorm=I=-18:TP=-2,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000" \
  -t 180 -c:a libmp3lame -b:a 192k public/audio/music-calm-placeholder.mp3
echo "wrote public/audio/music-calm-placeholder.mp3"
