import { requireVaultView } from "@/lib/server/vault";

export default async function VaultClassesPage() {
  const vault = await requireVaultView();

  return (
    <>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6a7dab]">Classes</p>
        <h1 className="text-2xl font-bold">My Classes</h1>
      </header>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[#6a7dab]">
            <tr>
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Price</th>
              <th className="px-2 py-2">Assets</th>
            </tr>
          </thead>
          <tbody>
            {vault.packages.map((pkg) => (
              <tr className="border-t border-[#e3eaf8]" key={pkg.id}>
                <td className="px-2 py-2 font-medium">{pkg.classCode ?? "-"}</td>
                <td className="px-2 py-2">{pkg.title}</td>
                <td className="px-2 py-2">{pkg.classDate ?? pkg.createdAt.slice(0, 10)}</td>
                <td className="px-2 py-2">{typeof pkg.classPrice === "number" ? `$${pkg.classPrice}` : "-"}</td>
                <td className="px-2 py-2">{pkg.assets.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
