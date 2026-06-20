const items = [
  "Skin Fades",
  "Beard Sculpts",
  "Hot-Towel Shaves",
  "Textured Cuts",
  "Razor Line-ups",
  "Classic Cuts",
  "Walk-ins Welcome",
];

export default function Marquee() {
  return (
    <div className="border-y border-coal-line bg-coal-soft py-4">
      <div className="flex animate-[marquee_28s_linear_infinite] gap-10 whitespace-nowrap motion-reduce:animate-none">
        {[...items, ...items, ...items].map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-lg font-medium uppercase tracking-widest text-bone/40"
          >
            {t}
            <span className="text-brass">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
