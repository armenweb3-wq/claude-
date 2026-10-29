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
 * Animation beats, in absolute seconds, locked to the voiceover cues above.
 * Scenes convert them to local frames with `beat(sceneId, key)`.
 */
export const beats = {
  intro: { retiree: 3.7 },
  gpu: { gpuReveal: 11.5 },
  datacenter: { racks: 17.6 },
  revenue: { q1: 22.6, q2: 25.0, q3: 26.9 },
  partners: { catalyst: 32.6 },
  price: { move: 37.6, land: 41.0 },
  split: { left: 43.2, right: 48.4, emphasis: 52.6 },
  disclaimer: { losses: 55.2, end: 58.2 },
} as const;

export const beat = <S extends keyof typeof beats>(scene: S, key: keyof (typeof beats)[S]) =>
  sec((beats[scene][key] as number) - sceneById(scene).start);

export const audio = { voiceoverFile: vo.voiceoverFile as string | null, musicFile: vo.musicFile as string | null };
