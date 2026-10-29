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

export const totalFrames = sec(vo.scenes[vo.scenes.length - 1].end);

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
  founder: { dots: cue("founder", 2).start },
  intro: { retiree: cue("intro", 2).start },
  gpu: { gpuReveal: cue("gpu", 2).start },
  why: { rush: cue("why", 1).start, shovels: cue("why", 2).start, chips: cue("why", 3).start + 1.2, buyers: cue("why", 4).start },
  datacenter: { racks: cue("datacenter", 1).start },
  revenue: { q1: cue("revenue", 2).start + 0.2, q2: cue("revenue", 3).start + 0.2, q3: cue("revenue", 4).start + 0.2, growth: cue("revenue", 5).start + 1.5 },
  partners: { catalyst: cue("partners", 1).start },
  price: { start: cue("price", 1).start, move: cue("price", 2).start + 0.6, land: cue("price", 2).end, gain: cue("price", 3).start },
  leverage: { own: cue("leverage", 1).start, borrow: cue("leverage", 2).start, total: cue("leverage", 3).start, multiple: cue("leverage", 4).start },
  invest: { invest: cue("invest", 1).start, rise: cue("invest", 2).start, profit: cue("invest", 3).start + 0.8, circle: cue("invest", 4).start },
  split: { left: sceneById("split").start + 0.3, right: cue("split", 1).start, emphasis: cue("split", 2).end - 0.5 },
  close: { risk: cue("close", 0).start, end: cue("close", 1).start },
};

/** Sound-design hits (absolute seconds) for the impact SFX layer. */
export const impacts = [beats.revenue.q3, beats.price.land, beats.invest.circle, beats.split.emphasis];

export const beat = <S extends keyof typeof beats>(scene: S, key: keyof (typeof beats)[S]) =>
  sec((beats[scene][key] as unknown as number) - sceneById(scene).start);

export const audio = { voiceoverFile: vo.voiceoverFile as string | null, musicFile: vo.musicFile as string | null };
