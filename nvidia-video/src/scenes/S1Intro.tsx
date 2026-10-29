import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Body, clamp, Column, Headline, Kicker, prog } from "../components/primitives";
import { beat } from "../data/timeline";
import { colors, fonts } from "../theme";

const uses = [
  { icon: "chat", label: "Answers questions" },
  { icon: "pulse", label: "Explains health info" },
  { icon: "globe", label: "Translates instantly" },
  { icon: "mail", label: "Writes emails" },
  { icon: "map", label: "Plans journeys" },
  { icon: "photo", label: "Organises photos" },
];

const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 44 }) => {
  const s = { fill: "none", stroke: colors.green, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {name === "chat" && <path {...s} d="M4 5h16v10H9l-5 4z" />}
      {name === "pulse" && <path {...s} d="M3 12h4l2-5 4 10 2-5h6" />}
      {name === "globe" && (
        <>
          <circle {...s} cx="12" cy="12" r="9" />
          <path {...s} d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </>
      )}
      {name === "mail" && <path {...s} d="M3 6h18v12H3zM3 7l9 6 9-6" />}
      {name === "map" && <path {...s} d="M12 21s-6-6-6-11a6 6 0 0112 0c0 5-6 11-6 11zM12 12a2 2 0 100-4 2 2 0 000 4z" />}
      {name === "photo" && <path {...s} d="M3 6h18v13H3zM3 16l5-5 4 4 3-3 6 6" />}
    </svg>
  );
};

/** Pulsing neural core with orbiting everyday-use chips. */
const AICore: React.FC<{ exit: number }> = ({ exit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cx = 540;
  const cy = 940;
  const pulse = 1 + Math.sin(f / 8) * 0.04;
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${exit * 12}px)`, transform: `scale(${1 - exit * 0.08})` }}>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="core">
            <stop offset="0%" stopColor={colors.greenBright} stopOpacity={0.95} />
            <stop offset="45%" stopColor={colors.green} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.green} stopOpacity={0} />
          </radialGradient>
        </defs>
        {[0, 1, 2].map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={140 + r * 95 + ((f * 1.4 + r * 40) % 95)}
            fill="none"
            stroke={colors.green}
            strokeOpacity={0.18 - r * 0.04}
            strokeWidth={1.5}
          />
        ))}
        {uses.map((_, i) => {
          const a = (i / uses.length) * Math.PI * 2 - Math.PI / 2 + f / 260;
          const p = prog(f, 14 + i * 7, 26);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(a) * 330 * p}
              y2={cy + Math.sin(a) * 300 * p}
              stroke={colors.green}
              strokeOpacity={0.35}
              strokeDasharray="4 8"
              strokeDashoffset={-f}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={150 * pulse} fill="url(#core)" />
        <circle cx={cx} cy={cy} r={58} fill={colors.ink} stroke={colors.green} strokeWidth={3} />
        <text x={cx} y={cy + 15} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={44} fill={colors.white}>
          AI
        </text>
      </svg>
      {uses.map((u, i) => {
        const a = (i / uses.length) * Math.PI * 2 - Math.PI / 2 + f / 260;
        const s = spring({ frame: f - 14 - i * 7, fps, config: { damping: 16, mass: 0.7 } });
        const x = cx + Math.cos(a) * 330;
        const y = cy + Math.sin(a) * 300;
        return (
          <div
            key={u.label}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${s})`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 20px",
              borderRadius: 18,
              background: "rgba(20,22,23,0.86)",
              border: `1px solid ${colors.line}`,
              boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
            }}
          >
            <Icon name={u.icon} size={34} />
            <span style={{ fontFamily: fonts.body, fontSize: 26, fontWeight: 500, color: colors.text }}>{u.label}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Dramatised retiree moment — a chat card that types itself. */
const RetireeCard: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - start, fps, config: { damping: 22, mass: 0.9 } });
  const question = "Can you explain this letter from my bank in simple words?";
  const typed = Math.floor(interpolate(f, [start + 14, start + 54], [0, question.length], clamp));
  const reply = prog(f, start + 62, 20);
  const dots = Math.floor(f / 6) % 4;
  return (
    <AbsoluteFill style={{ opacity: s, transform: `translateY(${(1 - s) * 120}px)` }}>
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 640,
          borderRadius: 36,
          padding: 44,
          background: `linear-gradient(160deg, ${colors.charcoal2}, ${colors.charcoal})`,
          border: `1px solid ${colors.line}`,
          boxShadow: `0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px ${colors.green}22`,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width={96} height={96} viewBox="0 0 96 96">
            <circle cx={48} cy={48} r={47} fill="#2a2e2f" stroke={colors.green} strokeWidth={2} />
            <circle cx={48} cy={38} r={15} fill="#c9cdc9" />
            <path d="M20 82c4-16 16-24 28-24s24 8 28 24" fill="#c9cdc9" />
            <path d="M33 34c2-10 28-10 30 0" stroke="#f5f5f5" strokeWidth={5} fill="none" strokeLinecap="round" />
          </svg>
          <div>
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 46, color: colors.text }}>Retiree, age 80</div>
            <div style={{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 3, color: colors.muted, textTransform: "uppercase" }}>
              Daily AI user · dramatisation
            </div>
          </div>
        </div>
        <div
          style={{
            alignSelf: "flex-end",
            maxWidth: 680,
            padding: "22px 28px",
            borderRadius: "28px 28px 6px 28px",
            background: colors.green,
            color: "#0b1200",
            fontFamily: fonts.body,
            fontSize: 34,
            fontWeight: 500,
            lineHeight: 1.35,
            minHeight: 92,
          }}
        >
          {question.slice(0, typed)}
          {typed < question.length && <span style={{ opacity: f % 16 < 8 ? 1 : 0 }}>▍</span>}
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: 680,
            padding: "22px 28px",
            borderRadius: "28px 28px 28px 6px",
            background: "#2a2e2f",
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 34,
            lineHeight: 1.35,
            opacity: typed >= question.length ? 1 : 0,
          }}
        >
          {reply < 0.05 ? "•".repeat(dots + 1) : <span style={{ opacity: reply }}>Of course. Here's what it means, step by step…</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const S1Intro: React.FC = () => {
  const f = useCurrentFrame();
  const retiree = beat("intro", "retiree");
  const exit = prog(f, retiree - 6, 22);
  const head2 = prog(f, retiree, 20);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AICore exit={exit} />
      <RetireeCard start={retiree} />
      <Column top={210} gap={30}>
        <Kicker delay={6}>The AI era</Kicker>
        <div style={{ position: "relative", height: 320 }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - prog(f, retiree - 9, 8) }}>
            <Headline text="AI is already part of everyday life." accent={["AI"]} delay={10} size={100} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: head2 }}>
            <Headline text="Even at 80, AI is part of the daily routine." accent={["80"]} delay={retiree + 1} size={92} />
          </div>
        </div>
      </Column>
      <div style={{ position: "absolute", left: 72, right: 72, top: 1290, opacity: 1 - exit }}>
        <Body delay={40} size={30} style={{ textAlign: "center" }}>
          Phones · health · travel · work · family
        </Body>
      </div>
    </AbsoluteFill>
  );
};
