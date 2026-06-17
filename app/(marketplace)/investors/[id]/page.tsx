import Link from "next/link";
import { notFound } from "next/navigation";
import ConnectButton from "@/components/marketplace/ConnectButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { Investor, Profile } from "@/lib/types";

export default async function InvestorDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
        Connect Supabase to view investor profiles. See docs/SETUP.md.
      </div>
    );
  }

  const supabase = createClient();
  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!investor) notFound();
  const i = investor as Investor;

  const { data: owner } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", i.owner_id)
    .single();
  const ownerProfile = owner as Profile | null;

  const { user } = await getCurrentUser();
  const isOwner = user?.id === i.owner_id;

  const check =
    i.check_min != null || i.check_max != null
      ? `$${Number(i.check_min ?? 0).toLocaleString()} – $${Number(
          i.check_max ?? 0,
        ).toLocaleString()}`
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/investors" className="text-sm text-slate-500 hover:text-slate-900">
        ← All investors
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700">
          {i.name.charAt(0)}
        </span>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{i.name}</h1>
          {i.location && <p className="mt-1 text-slate-600">{i.location}</p>}
        </div>
      </div>

      {i.thesis && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Investment thesis
          </h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">
            {i.thesis}
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {check && <Stat label="Check size" value={check} />}
        {i.website && (
          <Stat
            label="Website"
            value={
              <a
                href={i.website}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 hover:underline"
              >
                {i.website.replace(/^https?:\/\//, "")}
              </a>
            }
          />
        )}
      </div>

      {(i.sectors?.length || i.stages?.length) && (
        <div className="mt-6 space-y-3">
          {i.sectors?.length ? (
            <TagRow label="Sectors" items={i.sectors} />
          ) : null}
          {i.stages?.length ? <TagRow label="Stages" items={i.stages} /> : null}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        {isOwner ? (
          <p className="text-sm text-slate-600">
            This is your listing.{" "}
            <Link href="/dashboard" className="font-medium text-emerald-600 hover:underline">
              Edit it from your dashboard →
            </Link>
          </p>
        ) : (
          <>
            <h3 className="font-semibold text-slate-900">
              Want {i.name} to back you?
            </h3>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Send {ownerProfile?.full_name ?? "this investor"} a connection
              request with your pitch.
            </p>
            <ConnectButton
              toId={i.owner_id}
              toName={ownerProfile?.full_name?.split(" ")[0] ?? "investor"}
              signedIn={Boolean(user)}
              accent="emerald"
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TagRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
