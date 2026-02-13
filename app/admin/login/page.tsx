import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminUser } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="shell-bg min-h-screen bg-[linear-gradient(160deg,#dcecff_0%,#cfe4ff_35%,#eff5ff_100%)] px-4 py-8 text-[#00194c] md:px-8">
      <div className="shell-content mx-auto max-w-[1200px] overflow-hidden rounded-[26px] border border-white/70 bg-[#f2f7ff]/95 shadow-[0_30px_90px_rgba(8,28,76,0.2)]">
        <div className="flex items-center gap-2 border-b border-[#d9e5fb] px-6 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        <div className="grid min-h-[70vh] gap-10 p-8 md:grid-cols-[1fr_420px]">
          <div className="max-w-xl text-[#00194c]">
            <p className="text-xs uppercase tracking-[0.25em] text-[#b66c00]">Staff Console</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Recording Vault Admin</h1>
            <p className="mt-6 text-base text-[#4a5f93]">
              Manage your catalog entries and assign secure class recordings via n8n by video ID.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="card">
                <p className="text-xs text-[#6a7dab]">Catalog First</p>
                <p className="mt-1 text-sm font-semibold">Create reusable video entries</p>
              </div>
              <div className="card">
                <p className="text-xs text-[#6a7dab]">Controlled Access</p>
                <p className="mt-1 text-sm font-semibold">Provisioned emails only</p>
              </div>
            </div>
          </div>

          <div>
            <AdminLoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
