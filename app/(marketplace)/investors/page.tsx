import { InvestorCard } from "@/components/marketplace/Cards";
import SetupNotice from "@/components/marketplace/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Investor } from "@/lib/types";
import { site } from "@/data/site";

export const metadata = { title: `Investors — ${site.name}` };

export default async function InvestorsPage() {
  let investors: Investor[] = [];
  if (isSupabaseConfigured) {
    const supabase = createClient();
    const { data } = await supabase
      .from("investors")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    investors = (data as Investor[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Investors</h1>
          <p className="mt-1 text-slate-500">
            Find the right backers for your startup.
          </p>
        </div>
        <span className="text-sm text-slate-400">
          {investors.length} listed
        </span>
      </header>

      <div className="mt-8">
        {!isSupabaseConfigured ? (
          <SetupNotice what="Investor listings" />
        ) : investors.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No investors have been listed yet. Investors — create your listing
            from the dashboard.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {investors.map((i) => (
              <InvestorCard key={i.id} investor={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
