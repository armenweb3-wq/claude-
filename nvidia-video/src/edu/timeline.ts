/** Timing helpers for the education films. Every animation is cued from the narration script. */
export type VoScript = {
  fps: number;
  voiceoverFile: string | null;
  musicFile: string | null;
  scenes: { id: string; title: string; start: number; end: number }[];
  cues: { scene: string; start: number; end: number; text: string }[];
};

export const makeTimeline = (vo: VoScript) => {
  const sec = (s: number) => Math.round(s * vo.fps);
  const scenes = vo.scenes.map((s) => ({ ...s, from: sec(s.start), duration: sec(s.end) - sec(s.start) }));
  const cues = vo.cues.map((c) => ({ ...c, from: sec(c.start), to: sec(c.end) }));
  const sceneOf = (id: string) => {
    const s = vo.scenes.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown scene ${id}`);
    return s;
  };
  const line = (scene: string, n: number) => {
    const list = vo.cues.filter((c) => c.scene === scene);
    if (!list[n]) throw new Error(`No line ${n} in scene ${scene}`);
    return list[n];
  };
  return {
    scenes,
    cues,
    totalFrames: sec(vo.scenes[vo.scenes.length - 1].end),
    audio: { voice: vo.voiceoverFile, music: vo.musicFile },
    /** Local frame (inside its scene) where line n starts, plus an offset in seconds. */
    at: (scene: string, n: number, offset = 0) => sec(line(scene, n).start + offset) - sec(sceneOf(scene).start),
    /** Local frame where line n ends, plus an offset in seconds. */
    atEnd: (scene: string, n: number, offset = 0) => sec(line(scene, n).end + offset) - sec(sceneOf(scene).start),
  };
};
export type Timeline = ReturnType<typeof makeTimeline>;
