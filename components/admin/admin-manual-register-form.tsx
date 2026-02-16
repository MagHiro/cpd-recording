"use client";

import { FormEvent, useState } from "react";

export type RegisteredUser = {
  userId: string;
  email: string;
  vaultSlug: string;
  createdAt: string;
  packageCount: number;
  videoCount: number;
  lastProvisionedAt: string | null;
};

function parseMultiValueInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

export function AdminManualRegisterForm({ initialUsers = [] }: { initialUsers?: RegisteredUser[] }) {
  const [email, setEmail] = useState("");
  const [requestId, setRequestId] = useState("");
  const [classCodes, setClassCodes] = useState("");
  const [videoIds, setVideoIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<RegisteredUser[]>(initialUsers);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/admin/users/register", {
        method: "GET",
      });
      const data = (await response.json()) as { users?: RegisteredUser[] };
      if (!response.ok) return;
      setUsers(data.users ?? []);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          requestId: requestId.trim() || undefined,
          classCodes: parseMultiValueInput(classCodes),
          videoIds: parseMultiValueInput(videoIds),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        pendingVideoIds?: string[];
        details?: Array<{ path: string; message: string }>;
      };

      if (!response.ok) {
        const detailText = data.details
          ?.map((d) => `${d.path}: ${d.message}`)
          .join("; ");
        throw new Error(
          detailText
            ? `${data.error ?? "Failed to register user."} ${detailText}`
            : (data.error ?? "Failed to register user."),
        );
      }

      const pendingCount = data.pendingVideoIds?.length ?? 0;
      setMessage(
        pendingCount > 0
          ? `${data.message ?? "Done."} ${pendingCount} class(es) are pending video availability.`
          : (data.message ?? "User registered."),
      );
      setEmail("");
      setRequestId("");
      setClassCodes("");
      setVideoIds("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8e1f5] bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#6a7dab]">
            Manual Registration & Provisioning
          </p>
          <p className="mt-1 text-sm text-[#4a5f93]">
            Register by email and optionally provision class/video IDs
            immediately.
          </p>
        </div>

        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={submit}>
          <input
            className="field md:col-span-2"
            placeholder="customer@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="field md:col-span-2"
            placeholder="Request ID (optional)"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
          />
          <input
            className="field min-h-5"
            placeholder="Class codes (optional, comma or new line)"
            value={classCodes}
            onChange={(event) => setClassCodes(event.target.value)}
          />
          <input
            className="field min-h-5"
            placeholder="Video IDs (optional, comma or new line)"
            value={videoIds}
            onChange={(event) => setVideoIds(event.target.value)}
          />
          <button
            className="btn-primary mt-1 w-fit px-4 py-2 text-sm"
            disabled={loading}
            type="submit"
          >
            {loading ? "Submitting..." : "Register / Provision"}
          </button>
        </form>

        {message ? (
          <p className="mt-3 text-sm text-emerald-600">{message}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#d8e1f5] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#6a7dab]">
              Registered Users
            </p>
            <p className="mt-1 text-sm text-[#4a5f93]">
              {users.length} user(s)
            </p>
          </div>
          <button
            className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#f39c12]"
            disabled={loadingUsers}
            onClick={() => void loadUsers()}
            type="button"
          >
            {loadingUsers ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[#6a7dab]">
              <tr>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Vault</th>
                <th className="px-2 py-2">Classes</th>
                <th className="px-2 py-2">Videos</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Last Provisioned</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-[#e3eaf8]" key={user.userId}>
                  <td className="px-2 py-2">{user.email}</td>
                  <td className="px-2 py-2 font-mono text-xs text-[#4a5f93]">
                    {user.vaultSlug}
                  </td>
                  <td className="px-2 py-2">{user.packageCount}</td>
                  <td className="px-2 py-2">{user.videoCount}</td>
                  <td className="px-2 py-2">{user.createdAt.slice(0, 10)}</td>
                  <td className="px-2 py-2">
                    {user.lastProvisionedAt
                      ? user.lastProvisionedAt.slice(0, 10)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
