import { StartupCard } from "@/components/marketplace/Cards";
import SetupNotice from "@/components/marketplace/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Startup } from "@/lib/types";
import { site } from "@/data/site";

export const metadata = { title: `Startups — ${site.name}` };

export default async function StartupsPage() {
  let startups: Startup[] = [];
  if (isSupabaseConfigured) {
    const supabase = createClient();
    const { data } = await supabase
      .from("startups")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    startups = (data as Startup[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Startups</h1>
          <p className="mt-1 text-slate-500">
            Discover founders looking for their next investor.
          </p>
        </div>
        <span className="text-sm text-slate-400">
          {startups.length} listed
        </span>
      </header>

      <div className="mt-8">
        {!isSupabaseConfigured ? (
          <SetupNotice what="Startup listings" />
        ) : startups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {startups.map((s) => (
              <StartupCard key={s.id} startup={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      No startups have been listed yet. Be the first — create your listing from
      the dashboard.
    </div>
  );
}
