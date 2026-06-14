"use client";

import { useState } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import { contact } from "@/data/content";

export default function Contact() {
  const [sent, setSent] = useState(false);

  // Placeholder submit — wire to your CRM, email service or API route later.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="contact" className="section-pad bg-ink text-stone-50">
      <div className="mx-auto grid max-w-editorial gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow={contact.eyebrow}
            heading={contact.heading}
            intro={contact.intro}
            tone="light"
          />
          <dl className="mt-12 space-y-6 text-sm">
            <div>
              <dt className="text-[0.65rem] uppercase tracking-widest text-stone-50/50">Email</dt>
              <dd className="mt-1">
                <a href={`mailto:${contact.email}`} className="text-stone-50 hover:text-gold">
                  {contact.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase tracking-widest text-stone-50/50">Telephone</dt>
              <dd className="mt-1">
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-stone-50 hover:text-gold">
                  {contact.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase tracking-widest text-stone-50/50">Studio</dt>
              <dd className="mt-1 text-stone-50/80">{contact.address}</dd>
            </div>
          </dl>
        </div>

        <div>
          {sent ? (
            <div
              role="status"
              className="flex h-full min-h-[18rem] flex-col items-start justify-center rounded-sm border border-gold/40 bg-navy/40 p-10"
            >
              <span className="hairline mb-6" />
              <h3 className="font-serif text-3xl text-stone-50">Thank you.</h3>
              <p className="mt-3 max-w-sm text-sm text-stone-50/70">
                Your enquiry has been received. A member of our Paphos team will
                be in touch shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id="name" label="Full name" autoComplete="name" required />
                <Field id="email" label="Email" type="email" autoComplete="email" required />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id="phone" label="Telephone" type="tel" autoComplete="tel" />
                <div className="flex flex-col gap-2">
                  <label htmlFor="interest" className="text-xs uppercase tracking-widest text-stone-50/60">
                    Interest
                  </label>
                  <select
                    id="interest"
                    name="interest"
                    className="rounded-none border-b border-stone-50/25 bg-transparent py-2 text-stone-50 outline-none transition-colors focus:border-gold"
                  >
                    <option className="bg-ink">A specific residence</option>
                    <option className="bg-ink">Investment & residency</option>
                    <option className="bg-ink">General enquiry</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-xs uppercase tracking-widest text-stone-50/60">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="resize-none rounded-none border-b border-stone-50/25 bg-transparent py-2 text-stone-50 outline-none transition-colors focus:border-gold"
                  placeholder="Tell us what you're looking for…"
                />
              </div>
              <button type="submit" className="btn-gold mt-2">
                Send enquiry
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs uppercase tracking-widest text-stone-50/60">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="rounded-none border-b border-stone-50/25 bg-transparent py-2 text-stone-50 outline-none transition-colors placeholder:text-stone-50/30 focus:border-gold"
      />
    </div>
  );
}
