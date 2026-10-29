import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { founder } from "../data/content";
import { colors, fonts } from "../theme";

/**
 * The founder's portrait. Uses the licensed photo set in `founder.photo`; until one is supplied it
 * renders a monogram card. Never generate a face.
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
        // No licensed photo yet: a monogram portrait card (never a generated face).
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 40%, ${colors.charcoal2}, ${colors.ink} 75%)` }}>
          <div
            style={{
              width: "46%",
              aspectRatio: "1",
              borderRadius: "50%",
              border: `6px solid ${colors.green}`,
              boxShadow: `0 0 80px ${colors.green}55, inset 0 0 60px ${colors.green}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: "min(18vw, 200px)",
              color: colors.text,
              letterSpacing: -4,
              marginTop: "-14%",
            }}
          >
            {founder.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </div>
        </AbsoluteFill>
      )}
      {/* Grade: green-tinted shadows like the rest of the film. */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.green}14, transparent 40%, ${colors.ink}cc 100%)`, mixBlendMode: "multiply" }} />
      {grade === "duotone" && <AbsoluteFill style={{ background: colors.green, mixBlendMode: "color", opacity: 0.45 }} />}
    </AbsoluteFill>
  );
};
