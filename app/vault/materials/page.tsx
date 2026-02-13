import { Download, FileArchive, FileText } from "lucide-react";

import { requireVaultView } from "@/lib/server/vault";

export default async function VaultMaterialsPage() {
  const vault = await requireVaultView();
  const packagesWithMaterials = vault.packages
    .map((pkg) => ({
      ...pkg,
      materials: pkg.assets.filter((asset) => asset.type !== "VIDEO"),
    }))
    .filter((pkg) => pkg.materials.length > 0);

  return (
    <>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">Materials</p>
        <h1 className="text-2xl font-bold">Class Materials</h1>
      </header>

      {packagesWithMaterials.length > 0 ? (
        <div className="space-y-4">
          {packagesWithMaterials.map((pkg) => (
            <section className="card" key={pkg.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#6a7dab]">{pkg.classCode ?? "Class"}</p>
                  <h2 className="text-lg font-semibold text-[#12316a]">{pkg.title}</h2>
                </div>
                <div className="rounded-full border border-[#d8e1f5] bg-[#f8fbff] px-3 py-1 text-xs text-[#4a5f93]">
                  {pkg.classDate ?? pkg.createdAt.slice(0, 10)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {pkg.materials.map((asset) => {
                  const isPdf = asset.type === "PDF";
                  return (
                    <div key={asset.id} className="rounded-xl border border-[#dbe6fb] bg-[#f8fbff] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {isPdf ? <FileText size={16} /> : <FileArchive size={16} />}
                          <p className="text-sm font-semibold text-[#12316a]">{asset.title}</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-[#4a5f93]">
                          {asset.type}
                        </span>
                      </div>
                      <a
                        href={`/api/material/${asset.id}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs font-semibold text-[#12316a] hover:border-[#f39c12]"
                      >
                        <Download size={14} />
                        Open {isPdf ? "PDF" : "ZIP"}
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="card">
          <p className="text-sm text-[#5b6f9f]">No PDF/ZIP materials have been assigned yet.</p>
        </section>
      )}
    </>
  );
}
