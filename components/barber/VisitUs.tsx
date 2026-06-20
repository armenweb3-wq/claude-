import { shop, hours } from "@/data/barber";
import { SectionHead } from "./Section";

function today() {
  // hours[] is Monday-first; JS getDay() is Sunday-first.
  return (new Date().getDay() + 6) % 7;
}

function fmt(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ":" + m.toString().padStart(2, "0") : ""} ${period}`;
}

export default function VisitUs() {
  const todayIdx = today();
  const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(shop.mapsQuery)}&output=embed`;
  const directions = `https://maps.google.com/?q=${encodeURIComponent(shop.mapsQuery)}`;

  return (
    <section id="visit" className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
      <SectionHead
        eyebrow="Find Us"
        title="Visit the Shop"
        intro="Drop by in the heart of Brickell, or book ahead and skip the wait."
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {/* Hours */}
        <div className="rounded-2xl border border-coal-line bg-coal-soft p-7">
          <h3 className="font-display text-2xl font-semibold uppercase tracking-wide">
            Opening Hours
          </h3>
          <ul className="mt-5 divide-y divide-coal-line">
            {hours.map((h, i) => (
              <li
                key={h.day}
                className={`flex items-center justify-between py-3 text-sm ${
                  i === todayIdx ? "text-brass" : "text-bone/70"
                }`}
              >
                <span className="flex items-center gap-2 uppercase tracking-widest">
                  {h.day}
                  {i === todayIdx && (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px]">
                      Today
                    </span>
                  )}
                </span>
                <span className="font-medium">
                  {h.close ? `${fmt(h.open)} – ${fmt(h.close)}` : "Closed"}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-1 border-t border-coal-line pt-5 text-sm text-bone/70">
            <p className="font-medium text-bone">{shop.address.line1}</p>
            <p>{shop.address.line2}</p>
            <p className="pt-2">
              <a href={shop.phoneHref} className="text-brass hover:text-brass-soft">
                {shop.phone}
              </a>
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#book"
              className="rounded-full bg-brass px-7 py-3 text-xs font-semibold uppercase tracking-widest text-coal-deep transition-colors hover:bg-brass-soft"
            >
              Book a chair
            </a>
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-coal-line px-7 py-3 text-xs font-semibold uppercase tracking-widest text-bone/80 transition-colors hover:border-brass hover:text-brass"
            >
              Get directions
            </a>
          </div>
        </div>

        {/* Map */}
        <div className="overflow-hidden rounded-2xl border border-coal-line">
          <iframe
            title={`Map to ${shop.name}`}
            src={mapsUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full min-h-[320px] w-full grayscale contrast-125"
          />
        </div>
      </div>
    </section>
  );
}
