import { contact } from "@/data/content";

/** Treat the "Coming soon" placeholders as non-linkable plain text. */
const isPlaceholder = (v: string) => v.trim().toLowerCase() === "coming soon";

export default function Footer() {
  return (
    <footer className="bg-ink text-stone-50">
      <div className="mx-auto max-w-editorial px-6 py-16 sm:px-10 lg:px-16">
        <div className="flex flex-col justify-between gap-10 border-b border-stone-50/10 pb-10 md:flex-row">
          <div>
            <p className="font-serif text-2xl">
              Mkhitaryan <span className="text-gold">Developers</span>
            </p>
            <p className="mt-3 max-w-sm text-sm text-stone-50/60">
              Luxury residences along the Paphos coastline. A turnkey path to
              Mediterranean living.
            </p>
          </div>
          <address className="space-y-1 not-italic text-sm text-stone-50/70">
            <p>{contact.address}</p>
            <p>
              {isPlaceholder(contact.email) ? (
                contact.email
              ) : (
                <a href={`mailto:${contact.email}`} className="hover:text-gold">
                  {contact.email}
                </a>
              )}
            </p>
            <p>
              {isPlaceholder(contact.phone) ? (
                contact.phone
              ) : (
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-gold">
                  {contact.phone}
                </a>
              )}
            </p>
          </address>
        </div>
        <p className="mt-8 text-xs text-stone-50/40">
          © {new Date().getFullYear()} Mkhitaryan Developers. Paphos, Cyprus.
          Imagery and figures are illustrative placeholders.
        </p>
      </div>
    </footer>
  );
}
