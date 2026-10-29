import React from "react";
import { useCurrentFrame } from "remotion";
import { E, EF, In, p, Pop } from "./kit";

/** Opening title card for a session. */
export const CourseTitle: React.FC<{ session: number; title: string; objective: string; topics: string[]; topicsAt: number; accent: string }> = ({
  session,
  title,
  objective,
  topics,
  topicsAt,
  accent,
}) => {
  const f = useCurrentFrame();
  const a = p(f, 6, 26);
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 210 }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
        <div style={{ fontFamily: EF.mono, fontSize: 28, letterSpacing: 6, color: accent, fontWeight: 700 }}>EDUCATION · SESSION {session}</div>
        <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 128, lineHeight: 1, color: E.ink, letterSpacing: -3, marginTop: 18 }}>{title}</div>
        <div style={{ width: 160 * a, height: 8, borderRadius: 4, background: accent, margin: "34px 0" }} />
        <div style={{ fontFamily: EF.body, fontSize: 38, color: E.sub, maxWidth: 1300, lineHeight: 1.35 }}>{objective}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 50 }}>
        {topics.map((t, i) => (
          <Pop key={t} at={topicsAt + i * 9}>
            <div style={{ padding: "14px 26px", borderRadius: 100, background: "white", border: `2px solid ${accent}44`, fontFamily: EF.display, fontWeight: 700, fontSize: 32, color: E.ink, boxShadow: "0 8px 24px rgba(14,26,43,0.06)" }}>
              <span style={{ color: accent, fontFamily: EF.mono, marginRight: 12 }}>{String(i + 1).padStart(2, "0")}</span>
              {t}
            </div>
          </Pop>
        ))}
      </div>
    </div>
  );
};

/** End-of-session recap: checklist plus a pointer to what comes next. */
export const Recap: React.FC<{
  accent: string;
  title: string;
  items: { t: string; at: number }[];
  next?: { label: string; text: string; at: number };
}> = ({ accent, title, items, next }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 150 }}>
      <div style={{ fontFamily: EF.display, fontWeight: 800, fontSize: 84, color: E.ink, letterSpacing: -2, opacity: p(f, 4, 20) }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 36 }}>
        {items.map((it) => (
          <In key={it.t} at={it.at}>
            <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "22px 26px", borderRadius: 22, background: "white", border: `1px solid ${E.line}`, boxShadow: "0 10px 30px rgba(14,26,43,0.06)", height: 110, boxSizing: "border-box" }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, flex: "0 0 auto" }}>✓</div>
              <div style={{ fontFamily: EF.body, fontSize: 31, color: E.ink, lineHeight: 1.3 }}>{it.t}</div>
            </div>
          </In>
        ))}
      </div>
      {next && (
        <In at={next.at}>
          <div style={{ marginTop: 30, display: "inline-flex", alignItems: "center", gap: 20, padding: "18px 30px", borderRadius: 100, background: E.ink, color: "white" }}>
            <span style={{ fontFamily: EF.mono, fontSize: 24, letterSpacing: 3, color: accent === E.ink ? "white" : "#9DB8FF" }}>{next.label.toUpperCase()}</span>
            <span style={{ fontFamily: EF.display, fontWeight: 700, fontSize: 34 }}>{next.text} →</span>
          </div>
        </In>
      )}
    </div>
  );
};
