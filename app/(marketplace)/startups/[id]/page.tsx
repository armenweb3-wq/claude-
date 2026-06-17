import Link from "next/link";
import { notFound } from "next/navigation";
import ConnectButton from "@/components/marketplace/ConnectButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { Profile, Startup } from "@/lib/types";

export default async function StartupDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
        Connect Supabase to view startup profiles. See docs/SETUP.md.
      </div>
    );
  }

  const supabase = createClient();
  const { data: startup } = await supabase
    .from("startups")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!startup) notFound();
  const s = startup as Startup;

  const { data: owner } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", s.owner_id)
    .single();
  const ownerProfile = owner as Profile | null;

  const { user } = await getCurrentUser();
  const isOwner = user?.id === s.owner_id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/startups" className="text-sm text-slate-500 hover:text-slate-900">
        ← All startups
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-2xl font-bold text-indigo-700">
          {s.name.charAt(0)}
        </span>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{s.name}</h1>
          {s.tagline && <p className="mt-1 text-lg text-slate-600">{s.tagline}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {s.sector && <Tag>{s.sector}</Tag>}
            {s.stage && <Tag>{s.stage}</Tag>}
            {s.location && <Tag>{s.location}</Tag>}
          </div>
        </div>
      </div>

      {s.description && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            About
          </h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">
            {s.description}
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {s.funding_goal != null && (
          <Stat label="Raising" value={`$${Number(s.funding_goal).toLocaleString()}`} />
        )}
        {s.website && (
          <Stat
            label="Website"
            value={
              <a
                href={s.website}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {s.website.replace(/^https?:\/\//, "")}
              </a>
            }
          />
        )}
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        {isOwner ? (
          <p className="text-sm text-slate-600">
            This is your listing.{" "}
            <Link href="/dashboard" className="font-medium text-indigo-600 hover:underline">
              Edit it from your dashboard →
            </Link>
          </p>
        ) : (
          <>
            <h3 className="font-semibold text-slate-900">
              Interested in {s.name}?
            </h3>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Send {ownerProfile?.full_name ?? "the founder"} a connection request.
            </p>
            <ConnectButton
              toId={s.owner_id}
              toName={ownerProfile?.full_name?.split(" ")[0] ?? "founder"}
              signedIn={Boolean(user)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
      {children}
    </span>
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
