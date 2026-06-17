import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { site } from "@/data/site";

export const metadata = { title: `Admin — ${site.name}` };

export default async function AdminPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">
        Connect Supabase to enable the admin panel. See docs/SETUP.md.
      </div>
    );
  }

  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admins only</h1>
        <p className="mt-3 text-slate-500">
          This area is for the platform owner. If that&apos;s you, set your role to{" "}
          <code className="rounded bg-slate-100 px-1">admin</code> in Supabase
          (see the bottom of <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code>).
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const count = (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    return q;
  };

  const [
    totalUsers,
    founders,
    investors,
    admins,
    startupCount,
    investorListings,
    connectionCount,
    { data: recent },
  ] = await Promise.all([
    count("profiles"),
    count("profiles", ["role", "founder"]),
    count("profiles", ["role", "investor"]),
    count("profiles", ["role", "admin"]),
    count("startups"),
    count("investors"),
    count("connections"),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const users = (recent as Profile[]) ?? [];

  const stats = [
    { label: "Total members", value: totalUsers.count ?? 0, accent: "text-slate-900" },
    { label: "Founders", value: founders.count ?? 0, accent: "text-indigo-600" },
    { label: "Investors", value: investors.count ?? 0, accent: "text-emerald-600" },
    { label: "Admins", value: admins.count ?? 0, accent: "text-amber-600" },
    { label: "Startup listings", value: startupCount.count ?? 0, accent: "text-slate-900" },
    { label: "Investor listings", value: investorListings.count ?? 0, accent: "text-slate-900" },
    { label: "Connections made", value: connectionCount.count ?? 0, accent: "text-slate-900" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header>
        <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Owner view
        </span>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-slate-500">
          Everyone who has registered on {site.name}, at a glance.
        </p>
      </header>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className={`text-3xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Registered users */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent registrations
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden sm:table-cell">Headline</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No registrations yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {u.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden text-slate-500 sm:table-cell">
                      {u.headline ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Showing the {users.length} most recent members. Full data lives in your
          Supabase dashboard.
        </p>
      </section>
    </div>
  );
}
