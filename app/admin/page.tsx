import { redirect } from "next/navigation";
import { Activity, Cable, CheckCircle2, LayoutList, LogOut, Settings, ShieldCheck, Video } from "lucide-react";

import { AdminEntryManager } from "@/components/admin/admin-entry-manager";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { getAdminUser } from "@/lib/server/admin-auth";
import { getDriveConnectionInfo } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }
  const drive = await getDriveConnectionInfo();

  return (
    <main className="shell-bg min-h-screen bg-[linear-gradient(160deg,#dcecff_0%,#cfe4ff_35%,#eff5ff_100%)] px-4 py-8 text-[#00194c] md:px-8">
      <div className="shell-content mx-auto max-w-[1300px] overflow-hidden rounded-[26px] border border-white/70 bg-[#f2f7ff]/95 shadow-[0_30px_90px_rgba(8,28,76,0.2)]">
        <div className="flex items-center gap-2 border-b border-[#d9e5fb] px-6 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        <div className="grid min-h-[80vh] md:grid-cols-[230px_1fr]">
          <aside className="border-r border-[#d7e3fb] bg-[#eaf1fb] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1c64f2] text-white">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">Admin.</p>
                <p className="text-xs text-[#6a7dab]">Vault Control</p>
              </div>
            </div>

            <nav className="mt-10 space-y-2 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-[#1c64f2] px-4 py-3 font-semibold text-white">
                <Video size={16} />
                Catalog
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[#4a5f93]">
                <LayoutList size={16} />
                Provisioning
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[#4a5f93]">
                <Activity size={16} />
                Audit
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[#4a5f93]">
                <Settings size={16} />
                Settings
              </div>
            </nav>

            <div className="mt-12 rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-[#b66c00]">Logged in</p>
              <p className="mt-2 truncate text-sm font-semibold text-[#18346f]">{admin.email}</p>
            </div>

            <div className="mt-8">
              <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#6a7dab]">
                <LogOut size={13} />
                Session
              </div>
              <AdminLogoutButton />
            </div>
          </aside>

          <section className="p-5 md:p-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">Dashboard</p>
                <h1 className="text-2xl font-bold">Video Catalog Management</h1>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#d8e1f5] bg-white px-4 py-2 text-sm text-[#4a5f93]">
                <ShieldCheck size={14} />
                Restricted Admin Access
              </div>
            </header>

            <section className="mb-5 rounded-2xl border border-[#d8e1f5] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#6a7dab]">Google Drive Connection</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#18346f]">
                    {drive.hasStoredRefreshToken ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        Connected
                      </>
                    ) : (
                      <>
                        <Cable size={16} className="text-amber-600" />
                        Not connected
                      </>
                    )}
                  </div>
                  {drive.connectedEmail ? (
                    <p className="mt-1 text-xs text-[#4a5f93]">Connected account: {drive.connectedEmail}</p>
                  ) : null}
                </div>
                <a href="/api/admin/google/connect/start" className="btn-primary px-4 py-2 text-xs md:text-sm">
                  Connect Drive
                </a>
              </div>
            </section>

            <AdminEntryManager />
          </section>
        </div>
      </div>
    </main>
  );
}
