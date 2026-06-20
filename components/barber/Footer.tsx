import { shop, hours } from "@/data/barber";

function hoursSummary() {
  const open = hours.filter((h) => h.close);
  const closed = hours.filter((h) => !h.close).map((h) => h.day);
  const span = open.length
    ? `${open[0].open}–${open[0].close}`
    : "";
  return { closed, span };
}

export default function Footer() {
  const { closed, span } = hoursSummary();

  return (
    <footer className="border-t border-coal-line bg-coal-deep">
      <div className="mx-auto max-w-editorial px-6 py-14 lg:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <span className="font-display text-2xl font-bold uppercase tracking-widest">
              {shop.name}
            </span>
            <p className="mt-3 text-sm leading-relaxed text-bone/55">{shop.tagline}</p>
            <a
              href={shop.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-bone/60 hover:text-brass"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              {shop.instagramHandle}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-bone/40">Visit</p>
              <address className="mt-3 not-italic text-bone/65">
                {shop.address.line1}
                <br />
                {shop.address.line2}
              </address>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-bone/40">Hours</p>
              <p className="mt-3 text-bone/65">
                Open {span}
                <br />
                <span className="text-bone/45">Closed {closed.join(" & ")}</span>
              </p>
              <a href={shop.phoneHref} className="mt-3 block text-bone/65 hover:text-brass">
                {shop.phone}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-coal-line pt-6 text-xs text-bone/40 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {shop.name} · Paphos, Cyprus
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-brass">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-brass">
              Terms of Service
            </a>
            <a href="/barber/dashboard" className="hover:text-brass">
              Owner
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
