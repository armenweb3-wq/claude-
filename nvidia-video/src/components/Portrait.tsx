import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { founder } from "../data/content";
import { colors, fonts } from "../theme";

/**
 * The founder's portrait. Uses the licensed photo set in `founder.photo`; until one is supplied it
 * renders a neutral silhouette that is clearly labelled as a placeholder. Never generate a face.
 */
export const Portrait: React.FC<{ grade?: "cinematic" | "duotone"; label?: boolean; style?: React.CSSProperties }> = ({
  grade = "cinematic",
  label = true,
  style,
}) => {
  const filter = grade === "duotone" ? "grayscale(1) contrast(1.15) brightness(0.95)" : "saturate(0.75) contrast(1.08) brightness(0.92)";
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0c0f0d", ...style }}>
      {founder.photo ? (
        <Img src={staticFile(founder.photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%", filter }} />
      ) : (
        <svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="ph-bg" cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#26302a" />
              <stop offset="100%" stopColor="#0b0d0c" />
            </radialGradient>
            <linearGradient id="ph-rim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5b635e" stopOpacity={0.9} />
              <stop offset="35%" stopColor="#1a1f1c" stopOpacity={1} />
              <stop offset="100%" stopColor="#141816" />
            </linearGradient>
          </defs>
          <rect width="400" height="500" fill="url(#ph-bg)" />
          <path d="M60 500c8-92 64-140 140-140s132 48 140 140z" fill="url(#ph-rim)" />
          <ellipse cx="200" cy="225" rx="78" ry="96" fill="url(#ph-rim)" />
        </svg>
      )}
      {/* Grade: green-tinted shadows like the rest of the film. */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.green}14, transparent 40%, ${colors.ink}cc 100%)`, mixBlendMode: "multiply" }} />
      {grade === "duotone" && <AbsoluteFill style={{ background: colors.green, mixBlendMode: "color", opacity: 0.45 }} />}
      {label && !founder.photo && (
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: fonts.mono,
            fontSize: 22,
            letterSpacing: 3,
            color: colors.muted,
          }}
        >
          PORTRAIT PLACEHOLDER · ADD LICENSED PHOTO
        </div>
      )}
    </AbsoluteFill>
  );
};
