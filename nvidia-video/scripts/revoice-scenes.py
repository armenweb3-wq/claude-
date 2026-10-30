"""Re-record only some scenes of an existing narration, keeping every other line untouched.

Usage:
  python scripts/revoice-scenes.py --model DIR --script src/v1/data/voiceover.json --scenes split,disclaimer

The listed scenes' cues (edit their `text`/`say` first) are synthesised again and laid out inside
the scene's existing time window; the rest of the voice track is preserved sample for sample.
Cue start/end times for the re-recorded scenes are written back to the script JSON.
"""
import argparse, json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--script", required=True)
ap.add_argument("--scenes", required=True)
ap.add_argument("--speed", type=float, default=1.05)
args = ap.parse_args()

vo_path = os.path.join(ROOT, args.script)
vo = json.load(open(vo_path))
wav_path = os.path.join(ROOT, "public", vo["voiceoverFile"])
track, SR = sf.read(wav_path, dtype="float32")
k = Kokoro(os.path.join(args.model, "kokoro-v1.0.onnx"), os.path.join(args.model, "voices-v1.0.bin"))
voice = vo["voice"]["voice"]
LEAD, GAP, TAIL = 0.35, 0.3, 0.25

def speak(text, speed):
    a, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
    if sr != SR:
        raise SystemExit(f"sample rate mismatch {sr} vs {SR}")
    idx = np.where(np.abs(a) > 0.01)[0]
    pad = int(0.03 * sr)
    return a[max(0, idx[0] - pad): idx[-1] + pad]

ref_peak = np.max(np.abs(track)) or 1
for sid in args.scenes.split(","):
    scene = next(s for s in vo["scenes"] if s["id"] == sid)
    cues = [c for c in vo["cues"] if c["scene"] == sid]
    room = scene["end"] - scene["start"] - LEAD - TAIL - GAP * (len(cues) - 1)
    speed = args.speed
    for _ in range(4):
        clips = [speak(c["say"], speed) for c in cues]
        need = sum(len(a) for a in clips) / SR
        if need <= room or speed >= 1.3:
            break
        speed = min(1.3, speed * need / room * 1.01)
    s0, s1 = int(scene["start"] * SR), int(scene["end"] * SR)
    track[s0:s1] = 0
    t = scene["start"] + LEAD
    for c, a in zip(cues, clips):
        a = a / (np.max(np.abs(a)) or 1) * ref_peak * 0.95
        i = int(t * SR)
        track[i : i + len(a)] = a[: len(track) - i]
        c["start"], c["end"] = round(t, 2), round(t + len(a) / SR, 2)
        t = c["end"] + GAP
    print(f"{sid}: speed {speed:.2f}x, speech {need:.1f}s in {room:.1f}s")

sf.write(wav_path, track, SR)
json.dump(vo, open(vo_path, "w"), indent=2, ensure_ascii=False)
open(vo_path, "a").write("\n")
print("updated", vo["voiceoverFile"], "and", args.script)
