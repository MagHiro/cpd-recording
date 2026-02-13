import { VaultSidebar } from "@/components/vault/vault-sidebar";
import { requireVaultView } from "@/lib/server/vault";

export const dynamic = "force-dynamic";

export default async function VaultLayout({ children }: { children: React.ReactNode }) {
  const vault = await requireVaultView();

  return (
    <main className="shell-bg min-h-screen bg-[linear-gradient(160deg,#dcecff_0%,#cfe4ff_35%,#eff5ff_100%)] px-4 py-8 text-[#00194c] md:px-8">
      <div className="shell-content mx-auto max-w-[1300px] overflow-hidden rounded-[26px] border border-white/70 bg-[#f2f7ff]/95 shadow-[0_30px_90px_rgba(8,28,76,0.2)]">
        <div className="grid min-h-[80vh] md:grid-cols-[230px_1fr]">
          <VaultSidebar email={vault.email} />
          <section className="p-5 md:p-7">{children}</section>
        </div>
      </div>
    </main>
  );
}
