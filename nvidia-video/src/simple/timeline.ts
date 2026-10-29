import vo from "../data/voiceover-simple.json";

export const FPS = vo.fps;
const sec = (s: number) => Math.round(s * FPS);

export const scenes = vo.scenes.map((s) => ({ ...s, from: sec(s.start), duration: sec(s.end) - sec(s.start) }));
export const totalFrames = sec(vo.scenes[vo.scenes.length - 1].end);
export const cues = vo.cues.map((c) => ({ ...c, from: sec(c.start), to: sec(c.end) }));
export const audio = { voiceoverFile: vo.voiceoverFile, musicFile: vo.musicFile };

/**
 * Local frame (inside a scene) at which its n-th voiceover line starts, plus an offset in seconds.
 * Every animation is cued from the narration this way so pictures appear as they're mentioned.
 */
export const at = (scene: string, n = 0, offset = 0) => {
  const s = vo.scenes.find((x) => x.id === scene);
  const list = vo.cues.filter((c) => c.scene === scene);
  if (!s || !list[n]) throw new Error(`No cue ${n} in scene ${scene}`);
  return sec(list[n].start + offset) - sec(s.start);
};
/** Local frame at which the n-th line of a scene ends. */
export const atEnd = (scene: string, n = 0, offset = 0) => {
  const s = vo.scenes.find((x) => x.id === scene)!;
  const list = vo.cues.filter((c) => c.scene === scene);
  return sec(list[n].end + offset) - sec(s.start);
};
