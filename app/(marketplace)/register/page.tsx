import Link from "next/link";
import { RegisterForm } from "@/components/marketplace/AuthForms";
import { site } from "@/data/site";

export const metadata = { title: `Sign up — ${site.name}` };

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { role?: string };
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Join {site.name} as a founder or an investor.
      </p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RegisterForm defaultRole={searchParams.role ?? "founder"} />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
