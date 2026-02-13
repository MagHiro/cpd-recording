import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function RootSignInPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/vault");
  }

  return (
    <main className="shell-bg min-h-screen bg-[linear-gradient(180deg,#f5f8ff_0%,#eef3ff_100%)] px-6 py-20">
      <div className="shell-content mx-auto max-w-6xl overflow-hidden rounded-[26px] border border-white/70 bg-[#f2f7ff]/95 shadow-[0_30px_90px_rgba(8,28,76,0.2)]">
        <div className="flex items-center gap-2 border-b border-[#d9e5fb] px-6 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="grid gap-10 p-8 md:grid-cols-[1fr_420px]">
          <div className="max-w-xl text-[#00194c]">
            <p className="text-xs uppercase tracking-[0.25em] text-[#b66c00]">Private Access</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Your purchased recordings, one secure vault.</h1>
            <p className="mt-6 text-base text-[#4a5f93]">
              Login codes are sent only to your booking email. If your purchase has been provisioned, your package
              appears instantly after sign-in.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="card">
                <p className="text-xs text-[#6a7dab]">Protected streaming</p>
                <p className="mt-1 text-sm font-semibold">No direct Drive links exposed</p>
              </div>
              <div className="card">
                <p className="text-xs text-[#6a7dab]">Email-bound access</p>
                <p className="mt-1 text-sm font-semibold">Only booked account can open</p>
              </div>
            </div>
          </div>
          <div>
            <SignInForm />
          </div>
        </div>
      </div>
    </main>
  );
}
