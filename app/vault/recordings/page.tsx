import Link from "next/link";

import { VideoPlayer } from "@/components/video-player";
import { requireVaultView } from "@/lib/server/vault";

type RecordingsTab = "published" | "pending";

function normalizeTab(input?: string): RecordingsTab {
  return input === "pending" ? "pending" : "published";
}

export default async function VaultRecordingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const vault = await requireVaultView();
  const params = (await searchParams) ?? {};
  const activeTab = normalizeTab(params.tab);

  const publishedPackages = vault.packages.filter((pkg) =>
    pkg.assets.some((asset) => asset.type === "VIDEO"),
  );
  const pendingPackages = vault.packages.filter(
    (pkg) => !pkg.assets.some((asset) => asset.type === "VIDEO"),
  );
  const visiblePackages =
    activeTab === "published" ? publishedPackages : pendingPackages;
  const totalVideos = publishedPackages.reduce(
    (count, pkg) =>
      count + pkg.assets.filter((asset) => asset.type === "VIDEO").length,
    0,
  );
  const hasAnyClass = vault.packages.length > 0;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">
            Recordings
          </p>
          <h1 className="text-2xl font-bold">Recording Library</h1>
        </div>
        <div
          className="rounded-full border border-[#d8e1f5] bg-white px-4 py-2 text-sm text-[#4a5f93]"
          title="Published videos only"
        >
          {totalVideos} recording{totalVideos === 1 ? "" : "s"}
        </div>
      </header>

      <div className="mb-4 inline-flex rounded-xl border border-[#d8e1f5] bg-white p-1 text-sm">
        <Link
          href="/vault/recordings?tab=published"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            activeTab === "published" ? "bg-[#1c64f2] text-white" : "text-[#4a5f93]"
          }`}
        >
          Published ({publishedPackages.length})
        </Link>
        <Link
          href="/vault/recordings?tab=pending"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            activeTab === "pending" ? "bg-[#1c64f2] text-white" : "text-[#4a5f93]"
          }`}
        >
          Pending ({pendingPackages.length})
        </Link>
      </div>

      {hasAnyClass ? (
        <div className="space-y-4">
          {visiblePackages.map((pkg) => {
            const videos = pkg.assets.filter((asset) => asset.type === "VIDEO");

            return (
              <section className="card" key={pkg.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#6a7dab]">
                      {pkg.classCode ?? "Class"}
                    </p>
                    <h2 className="text-lg font-semibold text-[#12316a]">{pkg.title}</h2>
                  </div>
                  <div className="rounded-full border border-[#d8e1f5] bg-[#f8fbff] px-3 py-1 text-xs text-[#4a5f93]">
                    {pkg.classDate ?? pkg.createdAt.slice(0, 10)}
                  </div>
                </div>

                {videos.length > 0 ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {videos.map((asset) => (
                      <VideoPlayer
                        key={asset.id}
                        assetId={asset.id}
                        title={asset.title}
                        subtitle={`${pkg.classCode ?? "CLASS"} | ${
                          pkg.classDate ?? pkg.createdAt.slice(0, 10)
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#f5d99b] bg-[#fff7e8] px-4 py-3 text-sm text-[#7a4b00]">
                    Video is currently unavailable.
                  </div>
                )}
              </section>
            );
          })}

          {visiblePackages.length === 0 ? (
            <section className="card">
              <p className="text-sm text-[#5b6f9f]">
                {activeTab === "published"
                  ? "No published recordings are available yet."
                  : "No pending recordings right now."}
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="card">
          <p className="text-sm text-[#5b6f9f]">
            No recordings have been assigned to your vault yet.
          </p>
        </section>
      )}
    </>
  );
}
