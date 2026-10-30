import vo from "./voiceover.json";

export const FPS = vo.fps;
export const sec = (s: number) => Math.round(s * FPS);

export type SceneId = (typeof vo.scenes)[number]["id"];

/** Frames each scene overlaps its neighbour for a cross-dissolve. */
export const OVERLAP = 14;

export const scenes = vo.scenes.map((s) => ({ ...s, from: sec(s.start), duration: sec(s.end - s.start) }));
export const sceneById = (id: string) => {
  const s = scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

export const cues = vo.cues.map((c) => ({ ...c, from: sec(c.start), to: sec(c.end) }));

/**
 * Animation beats, in absolute seconds, derived from the measured voiceover cue timings
 * (scripts/generate-voiceover.py writes them) so visuals land on the spoken word.
 */
const c = vo.cues;
export const beats = {
  intro: { retiree: c[1].start },
  gpu: { gpuReveal: c[3].start },
  datacenter: { racks: c[5].start - 0.4 },
  revenue: { q1: c[6].start + 1.6, q2: c[7].start + 0.1, q3: c[7].start + 1.5 },
  partners: { catalyst: c[9].start - 0.2 },
  price: { move: c[10].start + 1.2, land: c[11].end },
  split: { left: c[12].start, circleA: c[12].end - 1.2, right: c[13].start, emphasis: c[13].end - 0.6 },
  disclaimer: { end: sceneById("disclaimer").start + 0.2 },
};

/** Sound-design hits (absolute seconds) for the impact SFX layer. */
export const impacts = [beats.revenue.q3, beats.price.land, beats.split.circleA, beats.split.emphasis];

export const beat = <S extends keyof typeof beats>(scene: S, key: keyof (typeof beats)[S]) =>
  sec((beats[scene][key] as unknown as number) - sceneById(scene).start);

export const audio = { voiceoverFile: vo.voiceoverFile as string | null, musicFile: vo.musicFile as string | null };
