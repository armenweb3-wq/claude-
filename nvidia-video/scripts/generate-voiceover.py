"""Generate the narration with Kokoro TTS (Apache-2.0 open model) and time the whole video to it.

Usage:
  python scripts/generate-voiceover.py --model DIR [--voice af_heart]

DIR holds kokoro-v1.0.onnx + voices-v1.0.bin from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Needs: pip install kokoro-onnx soundfile numpy

Each cue in src/data/voiceover.json is spoken from its `say` field (numbers written out for
natural pronunciation). The script then lays out the whole timeline: every scene gets at least
its `minDuration` and enough room for its lines, and any spare time up to `totalDuration` is
shared out in proportion. If the narration can't fit, the voice speeds up slightly (max 1.25x).
Scene boundaries and cue start/end are written back to voiceover.json, so scenes, subtitles and
animation beats (src/data/timeline.ts) all follow the real voice.
Output: public/audio/voiceover.wav, one continuous track.
"""
import argparse, json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--voice")
args = ap.parse_args()

vo_path = os.path.join(ROOT, "src/data/voiceover.json")
vo = json.load(open(vo_path))
voice = args.voice or vo["voice"]["voice"]
FPS, TOTAL = vo["fps"], vo["totalDuration"]
k = Kokoro(os.path.join(args.model, "kokoro-v1.0.onnx"), os.path.join(args.model, "voices-v1.0.bin"))
LEAD, GAP, TAIL = 0.4, 0.28, 0.3  # seconds

def speak(text, speed):
    audio, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
    idx = np.where(np.abs(audio) > 0.01)[0]
    pad = int(0.03 * sr)
    return audio[max(0, idx[0] - pad): idx[-1] + pad], sr

speed = vo["voice"]["baseSpeed"]
for _ in range(5):
    clips = [speak(c["say"], speed) for c in vo["cues"]]
    need = []
    for s in vo["scenes"]:
        idx = [i for i, c in enumerate(vo["cues"]) if c["scene"] == s["id"]]
        speech = sum(len(clips[i][0]) / clips[i][1] for i in idx)
        need.append(max(s["minDuration"], LEAD + speech + GAP * (len(idx) - 1) + TAIL))
    if sum(need) <= TOTAL or speed >= 1.25:
        break
    speed = min(1.25, speed * (sum(need) - len(need) * (LEAD + TAIL)) / (TOTAL - len(need) * (LEAD + TAIL)) * 1.01)

spare = max(0.0, TOTAL - sum(need))
durs = [n + spare * n / sum(need) for n in need]
t = 0.0
for s, d in zip(vo["scenes"], durs):
    s["start"] = round(round(t * FPS) / FPS, 3)
    t += d
    s["end"] = round(round(t * FPS) / FPS, 3)
vo["scenes"][-1]["end"] = TOTAL

SR = 24000
track = np.zeros(int(TOTAL * SR) + SR, dtype=np.float32)
for s in vo["scenes"]:
    t = s["start"] + LEAD
    for i, c in enumerate(vo["cues"]):
        if c["scene"] != s["id"]:
            continue
        a, sr = clips[i]
        c["start"], c["end"] = round(t, 2), round(t + len(a) / sr, 2)
        track[int(t * SR): int(t * SR) + len(a)] += a
        t = c["end"] + GAP
    print(f"{s['id']:<11} {s['start']:6.2f}–{s['end']:6.2f}s  ({s['end'] - s['start']:4.2f}s)  speech ends {t - GAP:6.2f}s")
print(f"voice speed {speed:.2f}x; total needed {sum(need):.2f}s of {TOTAL}s")

track = track[: int(TOTAL * SR)]
track = track / (np.max(np.abs(track)) or 1) * 0.89
sf.write(os.path.join(ROOT, "public/audio/voiceover.wav"), track, SR)
vo["voice"]["speed"] = round(speed, 3)
json.dump(vo, open(vo_path, "w"), indent=2, ensure_ascii=False)
open(vo_path, "a").write("\n")
print("wrote public/audio/voiceover.wav and updated scene + cue timings in src/data/voiceover.json")
