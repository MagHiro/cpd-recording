import { Mail, ShieldCheck } from "lucide-react";

import { requireVaultView } from "@/lib/server/vault";

export default async function VaultSettingsPage() {
  const vault = await requireVaultView();

  return (
    <>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">
          Settings
        </p>
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2 text-[#12316a]">
            <Mail size={16} />
            <p className="text-sm font-semibold">Provisioned Email</p>
          </div>
          <p className="mt-2 text-sm text-[#4a5f93]">{vault.email}</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-[#12316a]">
            <ShieldCheck size={16} />
            <p className="text-sm font-semibold">Access Policy</p>
          </div>
          <p className="mt-2 text-sm text-[#4a5f93]">
            Only assets provisioned for this email can be streamed or downloaded
            through this recording portal.
          </p>
        </div>
      </section>
    </>
  );
}
