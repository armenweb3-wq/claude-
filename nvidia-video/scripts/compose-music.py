"""Compose an original, royalty-free background score for the documentary cut.

Gentle cinematic piano over warm string-like pads: A minor → F → C → G, 72 bpm.
Sections build slowly (pad only → piano arpeggios → soft bass, heartbeat kick and a melody) and ease out at the end.
Everything is synthesised here, so there is no licensing to worry about.

Usage: python scripts/compose-music.py [--seconds 255] [--out public/audio/music-documentary.mp3]
Needs: numpy, soundfile, ffmpeg.
"""
import argparse, os, subprocess
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--seconds", type=float, default=255)
ap.add_argument("--out", default="public/audio/music-documentary.mp3")
args = ap.parse_args()

SR = 44100
BPM = 72
BEAT = 60 / BPM
BAR = BEAT * 4
total = args.seconds
n = int(total * SR) + SR * 4
L = np.zeros(n)
R = np.zeros(n)
rng = np.random.default_rng(7)

hz = lambda m: 440 * 2 ** ((m - 69) / 12)
# (pad voicing, bass root, arpeggio notes)
CHORDS = [
    ([57, 60, 64, 69], 45, [57, 64, 69, 72, 76, 72, 69, 64]),  # Am
    ([53, 57, 60, 65], 41, [53, 60, 65, 69, 72, 69, 65, 60]),  # F
    ([48, 55, 60, 64], 48, [55, 60, 64, 67, 72, 67, 64, 60]),  # C
    ([55, 59, 62, 67], 43, [55, 62, 67, 71, 74, 71, 67, 62]),  # G
]
MELODY = [76, None, 74, 72, None, 72, 71, None]  # gentle motif over each 2-bar chord in the later sections


def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= n:
        return
    sig = sig[: n - i] * gain
    L[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def piano(m, dur=2.6):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    s = sum((1 / k ** 1.6) * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k)) * np.exp(-t * (1.1 + 0.9 * k)) for k in range(1, 7))
    s *= np.minimum(1, t / 0.006)
    return s * 0.5


def pad(midis, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(1, t / 1.6) * np.minimum(1, (dur - t) / 1.6)
    s = np.zeros_like(t)
    for m in midis:
        for det in (-0.12, 0.0, 0.12):
            f = hz(m + det / 1)
            vib = 1 + 0.002 * np.sin(2 * np.pi * 4.8 * t + rng.uniform(0, 6))
            s += sum((1 / k ** 2.2) * np.sin(2 * np.pi * f * k * t * vib) for k in range(1, 5))
    return s * env * 0.05


def bass(m, dur):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 1.6) * np.minimum(1, t / 0.01) * 0.35


def kick():
    t = np.arange(int(0.5 * SR)) / SR
    return np.sin(2 * np.pi * (42 + 50 * np.exp(-t * 30)) * t) * np.exp(-t * 9) * 0.45


bars = int(np.ceil(total / BAR))
for b in range(bars):
    chord = CHORDS[(b // 2) % 4]
    t0 = b * BAR
    section = "intro" if b < 4 else ("outro" if b >= bars - 3 else ("A" if (b // 16) % 2 == 0 else "B"))
    if b % 2 == 0:
        add(pad(chord[0], BAR * 2 + 1.5), t0, gain=1.0 if section != "intro" else 0.8)
    if section in ("A", "B") or (section == "intro" and b >= 2):
        for i, m in enumerate(chord[2]):
            vel = 0.55 + 0.15 * (i % 4 == 0) + rng.uniform(-0.05, 0.05)
            if section == "intro" and i % 2:
                continue
            add(piano(m), t0 + i * BEAT / 2 + rng.uniform(0, 0.012), pan=-0.25 + 0.5 * (i / 7), gain=vel * 0.55)
    if section == "B":
        add(bass(chord[1], BAR), t0, gain=1.0)
        add(bass(chord[1], BAR / 2), t0 + 2 * BEAT, gain=0.7)
        for q in range(4):
            if q in (0, 2):
                add(kick(), t0 + q * BEAT, gain=0.8)
        if b % 2 == 0:
            for i, m in enumerate(MELODY):
                if m:
                    add(piano(m, 3.2), t0 + i * BEAT, pan=0.1, gain=0.42)
    if section == "outro" and b == bars - 3:
        add(piano(57, 6.0), t0, gain=0.6)
        add(piano(64, 6.0), t0 + 0.4, gain=0.45)
        add(piano(69, 6.0), t0 + 0.8, gain=0.45)

# Hall reverb: convolve each side with decaying noise (decorrelated left/right).
def reverb(x, seed):
    g = np.random.default_rng(seed)
    ir_t = np.arange(int(2.8 * SR)) / SR
    ir = g.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.9)
    ir[: int(0.02 * SR)] = 0
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return y / (np.max(np.abs(y)) + 1e-9)

wetL, wetR = reverb(L, 1), reverb(R, 2)
peak = max(np.max(np.abs(L)), np.max(np.abs(R))) + 1e-9
mixL = L / peak + 0.45 * wetL
mixR = R / peak + 0.45 * wetR
mix = np.stack([mixL, mixR], axis=1)[: int(total * SR)]
fade_in, fade_out = int(3 * SR), int(6 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5
mix /= np.max(np.abs(mix)) + 1e-9
tmp = os.path.join(ROOT, "out", "music-tmp.wav")
os.makedirs(os.path.dirname(tmp), exist_ok=True)
sf.write(tmp, (mix * 0.9).astype(np.float32), SR)
out = os.path.join(ROOT, args.out)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", "loudnorm=I=-17:TP=-1.5", "-ar", "48000",
                "-c:a", "libmp3lame", "-b:a", "224k", out], check=True)
os.remove(tmp)
print("wrote", args.out, f"({total:.0f}s)")
