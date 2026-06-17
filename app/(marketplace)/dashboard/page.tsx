import Link from "next/link";
import { redirect } from "next/navigation";
import { StartupForm, InvestorForm } from "@/components/marketplace/ListingForms";
import { respondToConnection } from "@/app/(marketplace)/connections/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth";
import type { Connection, Investor, Profile, Startup } from "@/lib/types";
import { site } from "@/data/site";

export const metadata = { title: `Dashboard — ${site.name}` };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-3 text-slate-500">
          Connect Supabase to enable accounts and listings. Follow{" "}
          <code className="rounded bg-slate-100 px-1">docs/SETUP.md</code>.
        </p>
      </div>
    );
  }

  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const p = profile as Profile;
  const isInvestor = p.role === "investor";

  const supabase = createClient();
  const [{ data: startup }, { data: investor }] = await Promise.all([
    supabase.from("startups").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("investors").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);

  // Connection requests received and sent, with the other person's name.
  const { data: incoming } = await supabase
    .from("connections")
    .select("*, from:profiles!from_id(full_name)")
    .eq("to_id", user.id)
    .order("created_at", { ascending: false });
  const { data: outgoing } = await supabase
    .from("connections")
    .select("*, to:profiles!to_id(full_name)")
    .eq("from_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {searchParams.welcome && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          🎉 Welcome to {site.name}! Fill out your{" "}
          {isInvestor ? "investor profile" : "startup listing"} below so the other
          side of the market can find you.
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {p.full_name ?? "Your"} dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as{" "}
            <span className="font-medium capitalize text-slate-700">{p.role}</span>
          </p>
        </div>
        {p.role === "admin" && (
          <Link
            href="/admin"
            className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
          >
            Open admin panel →
          </Link>
        )}
      </header>

      {/* Listing editor */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {isInvestor ? "Your investor profile" : "Your startup listing"}
        </h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          {isInvestor
            ? "This is what founders see when they browse investors."
            : "This is what investors see when they browse startups."}
        </p>
        {isInvestor ? (
          <InvestorForm investor={(investor as Investor) ?? null} />
        ) : (
          <StartupForm startup={(startup as Startup) ?? null} />
        )}
      </section>

      {/* Connections */}
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <ConnectionList
          title="Requests received"
          empty="No one has reached out yet."
          rows={(incoming as ConnRow[]) ?? []}
          which="incoming"
        />
        <ConnectionList
          title="Requests you sent"
          empty="You haven't reached out to anyone yet."
          rows={(outgoing as ConnRow[]) ?? []}
          which="outgoing"
        />
      </section>
    </div>
  );
}

type ConnRow = Connection & {
  from?: { full_name: string | null };
  to?: { full_name: string | null };
};

function ConnectionList({
  title,
  empty,
  rows,
  which,
}: {
  title: string;
  empty: string;
  rows: ConnRow[];
  which: "incoming" | "outgoing";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((c) => {
            const name =
              which === "incoming"
                ? c.from?.full_name ?? "Someone"
                : c.to?.full_name ?? "Someone";
            return (
              <li key={c.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{name}</span>
                  <StatusBadge status={c.status} />
                </div>
                {c.message && (
                  <p className="mt-1 text-sm text-slate-500">“{c.message}”</p>
                )}
                {which === "incoming" && c.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <form action={respondToConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value="accepted" />
                      <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                        Accept
                      </button>
                    </form>
                    <form action={respondToConnection}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value="declined" />
                      <button className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                        Decline
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Connection["status"] }) {
  const map = {
    pending: "bg-amber-50 text-amber-700",
    accepted: "bg-emerald-50 text-emerald-700",
    declined: "bg-slate-100 text-slate-500",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
}
