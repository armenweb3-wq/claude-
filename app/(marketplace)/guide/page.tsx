import Link from "next/link";
import { site } from "@/data/site";

export const metadata = {
  title: `How ${site.name} works — the guide`,
  description: `A plain-language roadmap of how ${site.name} connects startups and investors.`,
};

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          The guidance book
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          How {site.name} works
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Everything you need to understand the platform — and to explain it to a
          new member in two minutes.
        </p>
      </header>

      {/* In one sentence */}
      <Section title="In one sentence">
        <p>
          {site.name} is a <strong>matchmaking marketplace</strong>: startups
          create a profile of their company, investors create a profile of what
          they fund, and each side can browse the other and reach out. We make the
          introduction — the conversation and any deal happen directly between the
          two parties.
        </p>
        <Callout>
          No money moves through {site.name}. That keeps the platform simple and
          out of financial regulation — we connect people, we don&apos;t process
          investments.
        </Callout>
      </Section>

      {/* Who uses it */}
      <Section title="The two kinds of members">
        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            color="indigo"
            title="Founders (startups)"
            points={[
              "Register and pick “Startup / Founder”.",
              "Build a listing: name, tagline, sector, stage, how much they’re raising.",
              "Browse investors and send connection requests.",
            ]}
          />
          <RoleCard
            color="emerald"
            title="Investors"
            points={[
              "Register and pick “Investor”.",
              "Publish a thesis: sectors, stages, and check size.",
              "Browse startups and reach out to promising ones.",
            ]}
          />
        </div>
      </Section>

      {/* The journey */}
      <Section title="The member journey, step by step">
        <ol className="space-y-4">
          {[
            ["Register", "They choose founder or investor and create an account with email + password."],
            ["Build a profile", "A guided form on the dashboard captures everything the other side needs to know."],
            ["Go live", "The listing instantly appears in the public Startups or Investors directory."],
            ["Discover", "They browse the other side of the market — filtered by sector, stage and check size."],
            ["Connect", "They send a connection request with a short note. The recipient accepts or declines."],
            ["Take it offline", "Once connected, the two parties continue the conversation directly."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{t}</p>
                <p className="text-slate-600">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Owner / admin */}
      <Section title="Your role as the owner (admin)">
        <p>
          You have a private <Link href="/admin" className="font-medium text-indigo-600 hover:underline">admin dashboard</Link> that
          no member can see. It shows:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
          <li>How many people have registered, split into founders and investors.</li>
          <li>How many startup and investor listings exist.</li>
          <li>How many connections have been made across the platform.</li>
          <li>A table of every recent registration — name, role and join date.</li>
        </ul>
        <Callout>
          To become an admin: register normally, then run the one-line SQL at the
          bottom of <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code> with
          your email. After that, an “Admin” link appears in your navigation.
        </Callout>
      </Section>

      {/* Script */}
      <Section title="How to explain it to a new member (a script)">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
          <p className="italic">
            “{site.name} is where startups and investors find each other. If you
            have a company and you&apos;re raising money, you create a short profile
            and you&apos;ll show up for investors searching for exactly what you do.
            If you&apos;re an investor, you tell us what you back and you&apos;ll see
            startups that fit. When you find someone interesting, you send a request
            to connect — if they accept, you take it from there. It&apos;s free to
            join and you can look around before signing up.”
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="Quick answers (FAQ)">
        <Faq q="Is it free?" a="Yes — joining, listing and browsing are all free in this version. A paid tier can be added later." />
        <Faq q="Does the platform handle the actual investment?" a="No. We make introductions only. All negotiation and money happen directly between the two parties, off-platform." />
        <Faq q="Can someone be both a founder and an investor?" a="Each account is one role. A person who is both can keep two accounts, or we can add dual-role support later." />
        <Faq q="Who can see the admin dashboard?" a="Only accounts whose role is set to admin in the database. Regular members never see it." />
        <Faq q="Where is the data stored?" a="In your own Supabase project — a secure, managed Postgres database that you control." />
      </Section>

      <div className="mt-12 rounded-2xl bg-slate-900 p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Ready to see it in action?</h2>
        <p className="mt-2 text-slate-300">
          Create an account and build your first profile.
        </p>
        <Link
          href="/register"
          className="mt-5 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
      {children}
    </div>
  );
}

function RoleCard({
  color,
  title,
  points,
}: {
  color: "indigo" | "emerald";
  title: string;
  points: string[];
}) {
  const border = color === "indigo" ? "border-indigo-100" : "border-emerald-100";
  const bg = color === "indigo" ? "bg-indigo-50/50" : "bg-emerald-50/50";
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5`}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-slate-200 py-3">
      <summary className="cursor-pointer list-none font-medium text-slate-900 marker:content-none">
        <span className="mr-2 text-slate-400 group-open:rotate-90 inline-block transition">
          ›
        </span>
        {q}
      </summary>
      <p className="mt-2 pl-5 text-slate-600">{a}</p>
    </details>
  );
}
