import vo from "./voiceover.json";

export const FPS = vo.fps;
export const sec = (s: number) => Math.round(s * FPS);

export type SceneId = (typeof vo.scenes)[number]["id"];

/** Frames each scene overlaps its neighbour for a cross-dissolve. */
export const OVERLAP = 14;

export const scenes = vo.scenes.map((s) => ({ ...s, from: sec(s.start), duration: sec(s.end) - sec(s.start) }));
export const sceneById = (id: string) => {
  const s = scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

export const cues = vo.cues.map((c) => ({ ...c, from: sec(c.start), to: sec(c.end) }));

/** The n-th voiceover cue of a scene (cue timings are written by scripts/generate-voiceover.py). */
const cue = (scene: string, n = 0) => {
  const list = vo.cues.filter((c) => c.scene === scene);
  if (!list[n]) throw new Error(`No cue ${n} in scene ${scene}`);
  return list[n];
};

/**
 * Animation beats, in absolute seconds, derived from the measured voiceover cue timings
 * so visuals land on the spoken word.
 */
export const beats = {
  founder: { dots: cue("founder", 1).start },
  intro: { retiree: cue("intro", 1).start },
  gpu: { gpuReveal: cue("gpu", 0).start + 1.0 },
  datacenter: { racks: cue("datacenter").start + 1.8 },
  revenue: { q1: cue("revenue", 0).start + 1.2, q2: cue("revenue", 1).start + 0.2, q3: cue("revenue", 1).start + 1.6 },
  partners: { catalyst: cue("partners").start + 1.9 },
  price: { move: cue("price", 0).start + 0.5, land: cue("price", 1).end },
  invest: { invest: cue("invest", 0).start + 0.5, profit: cue("invest", 1).start + 0.7, circle: cue("invest", 1).start + 2.1 },
  split: { left: sceneById("split").start + 0.1, right: cue("split").start + 0.2, emphasis: cue("split").end - 0.3 },
  disclaimer: { losses: cue("disclaimer", 0).start + 1.0, end: cue("disclaimer", 1).start + 0.2 },
};

/** Sound-design hits (absolute seconds) for the impact SFX layer. */
export const impacts = [beats.revenue.q3, beats.price.land, beats.invest.circle, beats.split.emphasis];

export const beat = <S extends keyof typeof beats>(scene: S, key: keyof (typeof beats)[S]) =>
  sec((beats[scene][key] as unknown as number) - sceneById(scene).start);

export const audio = { voiceoverFile: vo.voiceoverFile as string | null, musicFile: vo.musicFile as string | null };
