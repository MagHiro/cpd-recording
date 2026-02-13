import { requireVaultView, shortMonth } from "@/lib/server/vault";
import { VideoPlayer } from "@/components/video-player";

export default async function VaultOverviewPage() {
  const vault = await requireVaultView();
  const allAssets = vault.packages.flatMap((pkg) => pkg.assets);
  const videos = allAssets.filter((asset) => asset.type === "VIDEO");
  const materials = allAssets.filter((asset) => asset.type !== "VIDEO");
  const latestPackage = vault.packages[0];
  const featuredVideos = latestPackage ? latestPackage.assets.filter((asset) => asset.type === "VIDEO").slice(0, 2) : [];

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">Dashboard</p>
          <h1 className="text-2xl font-bold">Your Learning Vault</h1>
        </div>
        <div className="rounded-full border border-[#d8e1f5] bg-white px-4 py-2 text-sm text-[#4a5f93]">
          {vault.packages.length} package{vault.packages.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card">
          <p className="text-xs text-[#6a7dab]">Total Videos</p>
          <p className="mt-2 text-3xl font-bold">{videos.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-[#6a7dab]">Materials</p>
          <p className="mt-2 text-3xl font-bold">{materials.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-[#6a7dab]">Active Classes</p>
          <p className="mt-2 text-3xl font-bold">{vault.packages.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-[#6a7dab]">Latest Class</p>
          <p className="mt-2 text-2xl font-bold">{shortMonth(latestPackage?.classDate ?? latestPackage?.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card">
          <h2 className="text-lg font-semibold">Featured Recordings</h2>
          {featuredVideos.length > 0 ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {featuredVideos.map((asset) => (
                <VideoPlayer key={asset.id} assetId={asset.id} title={asset.title} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#5b6f9f]">No recordings available yet.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl bg-[linear-gradient(165deg,#0f45be_0%,#1c64f2_58%,#29b7f0_100%)] p-6 text-white shadow-[0_20px_40px_rgba(20,68,180,0.35)]">
          <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">NEW</p>
          <h2 className="mt-6 text-3xl font-bold leading-tight">Protected access</h2>
          <p className="mt-4 text-sm text-blue-100">
            Your vault is restricted to your booking email only. New purchases appear automatically after provisioning.
          </p>
          <div className="mt-6 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-[#0d3eaa]">
            Signed provisioning enabled
          </div>
        </section>
      </div>
    </>
  );
}
