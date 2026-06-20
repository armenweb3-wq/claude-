import { shop } from "@/data/barber";

export default function Footer() {
  return (
    <footer className="border-t border-coal-line bg-coal-deep">
      <div className="mx-auto max-w-editorial px-6 py-14 lg:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <span className="font-display text-2xl font-bold uppercase tracking-widest">
              {shop.name}
            </span>
            <p className="mt-3 text-sm leading-relaxed text-bone/55">{shop.tagline}</p>
            <div className="mt-5 flex gap-4">
              <a
                href={shop.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium uppercase tracking-widest text-bone/60 hover:text-brass"
              >
                Instagram
              </a>
              <a
                href={shop.social.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium uppercase tracking-widest text-bone/60 hover:text-brass"
              >
                TikTok
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-bone/40">
                Visit
              </p>
              <address className="mt-3 not-italic text-bone/65">
                {shop.address.line1}
                <br />
                {shop.address.line2}
              </address>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-bone/40">
                Contact
              </p>
              <ul className="mt-3 space-y-2 text-bone/65">
                <li>
                  <a href={shop.phoneHref} className="hover:text-brass">
                    {shop.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${shop.email}`} className="hover:text-brass">
                    {shop.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-coal-line pt-6 text-xs text-bone/40 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {shop.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="/barber/dashboard" className="hover:text-brass">
              Owner dashboard
            </a>
            <p>Crafted with precision — like every cut.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
