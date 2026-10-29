"""Generate the narration with Kokoro TTS (Apache-2.0 open model) and time the whole video to it.

Usage:
  python scripts/generate-voiceover.py --model DIR [--voice af_heart]

DIR holds kokoro-v1.0.onnx + voices-v1.0.bin from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Needs: pip install kokoro-onnx soundfile numpy

Each cue in src/data/voiceover.json is spoken from its `say` field (numbers written out for
natural pronunciation) and laid out inside its scene. If a scene's lines don't fit, that scene
is re-spoken slightly faster (max 1.3x). The measured start/end of every cue is written back to
voiceover.json, so subtitles and animation beats (src/data/timeline.ts) follow the real voice.
Output: public/audio/voiceover.wav, one continuous track for the full video.
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
base = vo["voice"]["baseSpeed"]
k = Kokoro(os.path.join(args.model, "kokoro-v1.0.onnx"), os.path.join(args.model, "voices-v1.0.bin"))

LEAD, GAP, TAIL = 0.35, 0.3, 0.25  # seconds: after scene start, between lines, before scene end

def speak(text, speed):
    audio, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
    idx = np.where(np.abs(audio) > 0.01)[0]
    pad = int(0.03 * sr)
    return audio[max(0, idx[0] - pad): idx[-1] + pad], sr

total = vo["scenes"][-1]["end"]
SR = 24000
track = np.zeros(int(total * SR) + SR, dtype=np.float32)
for scene in vo["scenes"]:
    cues = [c for c in vo["cues"] if c["scene"] == scene["id"]]
    room = scene["end"] - scene["start"] - LEAD - TAIL - GAP * (len(cues) - 1)
    speed = base
    for _ in range(4):
        clips = [speak(c["say"], speed) for c in cues]
        need = sum(len(a) / sr for a, sr in clips)
        if need <= room or speed >= 1.3:
            break
        speed = min(1.3, speed * need / room * 1.01)
    t = scene["start"] + LEAD
    for c, (a, sr) in zip(cues, clips):
        assert sr == SR
        c["start"], c["end"] = round(t, 2), round(t + len(a) / sr, 2)
        track[int(t * SR): int(t * SR) + len(a)] += a
        t = c["end"] + GAP
    flag = "  OVER BY %.2fs" % (t - GAP - (scene["end"] - TAIL)) if t - GAP > scene["end"] - TAIL + 0.01 else ""
    print(f"{scene['id']:<11} speed {speed:.2f}x  speech {need:4.1f}s / room {room:4.1f}s{flag}")

track = track[: int(total * SR)]
track = track / (np.max(np.abs(track)) or 1) * 0.89  # about -1 dBFS peak
sf.write(os.path.join(ROOT, "public/audio/voiceover.wav"), track, SR)
json.dump(vo, open(vo_path, "w"), indent=2, ensure_ascii=False)
open(vo_path, "a").write("\n")
print("wrote public/audio/voiceover.wav and updated cue timings in src/data/voiceover.json")
