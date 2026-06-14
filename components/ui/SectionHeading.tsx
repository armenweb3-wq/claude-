import Reveal from "./Reveal";

type Props = {
  eyebrow: string;
  heading: string;
  intro?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
};

export default function SectionHeading({
  eyebrow,
  heading,
  intro,
  align = "left",
  tone = "dark",
}: Props) {
  const isCenter = align === "center";
  return (
    <Reveal
      stagger
      className={`flex flex-col gap-5 ${isCenter ? "items-center text-center" : "items-start"}`}
    >
      <span data-reveal-item className="eyebrow">
        {eyebrow}
      </span>
      <h2
        data-reveal-item
        className={`display max-w-3xl text-4xl sm:text-5xl md:text-6xl ${
          tone === "light" ? "text-stone-50" : "text-ink"
        }`}
      >
        {heading}
      </h2>
      {intro && (
        <p
          data-reveal-item
          className={`lead max-w-2xl ${tone === "light" ? "text-stone-50/70" : ""}`}
        >
          {intro}
        </p>
      )}
      <span data-reveal-item className={`hairline mt-2 ${isCenter ? "self-center" : ""}`} />
    </Reveal>
  );
}
