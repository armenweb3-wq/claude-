import Link from "next/link";
import { site } from "@/data/site";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            The marketplace for founders & investors
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Where startups meet the investors who back them.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            {site.description}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register?role=founder"
              className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 sm:w-auto"
            >
              I&apos;m a startup →
            </Link>
            <Link
              href="/register?role=investor"
              className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 sm:w-auto"
            >
              I&apos;m an investor →
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Free to join · Browse without signing up
          </p>
        </div>
      </section>

      {/* Two paths */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-8">
            <h2 className="text-2xl font-bold text-slate-900">For founders</h2>
            <p className="mt-2 text-slate-600">
              Build a profile of your company, share your traction and how much
              you&apos;re raising, and get discovered by the right investors.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <li>• Create a polished startup listing in minutes</li>
              <li>• Browse investors by sector, stage and check size</li>
              <li>• Reach out and track who you&apos;ve connected with</li>
            </ul>
            <Link
              href="/register?role=founder"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
            >
              List your startup
            </Link>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8">
            <h2 className="text-2xl font-bold text-slate-900">For investors</h2>
            <p className="mt-2 text-slate-600">
              Publish your investment thesis and discover vetted startups that
              match exactly what you&apos;re looking to fund.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <li>• Share your thesis, sectors and check size</li>
              <li>• Filter the deal flow that fits your strategy</li>
              <li>• Connect with founders directly</li>
            </ul>
            <Link
              href="/register?role=investor"
              className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
            >
              Join as an investor
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                n: "1",
                t: "Create your account",
                d: "Sign up as a founder or an investor — it takes a minute.",
              },
              {
                n: "2",
                t: "Build your profile",
                d: "Startups describe their company; investors share their thesis.",
              },
              {
                n: "3",
                t: "Connect",
                d: "Browse the other side of the market and reach out to a match.",
              },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.t}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-slate-500">
            {site.name} is a matchmaking platform. We help the two sides find each
            other — all conversations and any investment happen directly between
            you.{" "}
            <Link href="/guide" className="font-medium text-indigo-600 hover:underline">
              Read the full guide →
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">
          Ready to find your match?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-600">
          Join {site.name} today and start building the connections that move your
          venture forward.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-8 py-3 font-semibold text-white hover:bg-slate-800"
        >
          Get started — it&apos;s free
        </Link>
      </section>
    </>
  );
}
