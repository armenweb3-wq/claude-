// Shown wherever live data would appear before Supabase keys are added, so the
// client can click through the whole product and see exactly what goes where.
export default function SetupNotice({ what = "Live data" }: { what?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="font-semibold">{what} appears here once Supabase is connected.</p>
      <p className="mt-1 text-amber-800/80">
        Add your <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        and run <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>. Full
        steps are in <code className="rounded bg-amber-100 px-1">docs/SETUP.md</code>.
      </p>
    </div>
  );
}
