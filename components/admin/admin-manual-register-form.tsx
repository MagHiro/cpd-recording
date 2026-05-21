"use client";

import { Fragment, FormEvent, useMemo, useState } from "react";

export type RegisteredUser = {
  userId: string;
  email: string;
  vaultSlug: string;
  createdAt: string;
  packageCount: number;
  videoCount: number;
  lastProvisionedAt: string | null;
};

type UserVaultClass = {
  packageId: string;
  classCode: string | null;
  title: string;
  classDate: string | null;
  assetCount: number;
  videoCount: number;
  createdAt: string;
};

type SortKey = "email" | "vault" | "classes" | "videos" | "created" | "lastProvisioned";
type SortDirection = "asc" | "desc";

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

function compareNullableStrings(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function classCounts(classes: UserVaultClass[]) {
  const createdDates = classes.map((item) => item.createdAt).sort();
  return {
    packageCount: classes.length,
    videoCount: classes.reduce((count, item) => count + item.videoCount, 0),
    lastProvisionedAt: createdDates[createdDates.length - 1] ?? null,
  };
}

export function AdminManualRegisterForm({ initialUsers = [] }: { initialUsers?: RegisteredUser[] }) {
  const [email, setEmail] = useState("");
  const [classCodes, setClassCodes] = useState("");
  const [videoIds, setVideoIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [removingAllUsers, setRemovingAllUsers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [removeAllMessage, setRemoveAllMessage] = useState<string | null>(null);
  const [removeAllError, setRemoveAllError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [users, setUsers] = useState<RegisteredUser[]>(initialUsers);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userClasses, setUserClasses] = useState<Record<string, UserVaultClass[]>>({});
  const [classInputs, setClassInputs] = useState<Record<string, string>>({});
  const [userActionLoading, setUserActionLoading] = useState<Record<string, boolean>>({});
  const [userActionError, setUserActionError] = useState<Record<string, string | null>>({});
  const [userActionMessage, setUserActionMessage] = useState<Record<string, string | null>>({});

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (sortKey === "lastProvisioned") {
        if (!a.lastProvisionedAt && !b.lastProvisionedAt) return 0;
        if (!a.lastProvisionedAt) return 1;
        if (!b.lastProvisionedAt) return -1;
        const result = a.lastProvisionedAt.localeCompare(b.lastProvisionedAt);
        return sortDirection === "asc" ? result : -result;
      }

      let result = 0;
      if (sortKey === "email") result = a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
      if (sortKey === "vault") result = a.vaultSlug.localeCompare(b.vaultSlug, undefined, { sensitivity: "base" });
      if (sortKey === "classes") result = a.packageCount - b.packageCount;
      if (sortKey === "videos") result = a.videoCount - b.videoCount;
      if (sortKey === "created") result = compareNullableStrings(a.createdAt, b.createdAt);
      return sortDirection === "asc" ? result : -result;
    });
  }, [sortDirection, sortKey, users]);

  function setUserLoading(userId: string, value: boolean) {
    setUserActionLoading((current) => ({ ...current, [userId]: value }));
  }

  function setUserStatus(userId: string, status: { message?: string | null; error?: string | null }) {
    setUserActionMessage((current) => ({ ...current, [userId]: status.message ?? null }));
    setUserActionError((current) => ({ ...current, [userId]: status.error ?? null }));
  }

  function updateUserCounts(userId: string, classes: UserVaultClass[]) {
    const counts = classCounts(classes);
    setUsers((current) =>
      current.map((user) =>
        user.userId === userId
          ? {
              ...user,
              ...counts,
            }
          : user,
      ),
    );
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "email" || key === "vault" ? "asc" : "desc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ^" : " v";
  }

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
      setClassCodes("");
      setVideoIds("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register user.");
    } finally {
      setLoading(false);
    }
  }

  async function importRegistrantsCsv(event: FormEvent) {
    event.preventDefault();
    if (!importFile) {
      setImportError("Select a CSV file first.");
      return;
    }

    setImportingCsv(true);
    setImportMessage(null);
    setImportError(null);

    try {
      const sourceCsv = await importFile.text();
      const response = await fetch("/api/admin/users/import-registrants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: sourceCsv }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to import CSV.");
      }

      const data = (await response.json()) as {
        message?: string;
        totalRows?: number;
        validRows?: number;
        uniqueEmails?: number;
        upsertedUsers?: number;
        provisionedClassCodes?: number;
        skippedInvalid?: number;
        failedUsers?: number;
      };
      setImportMessage(
        `${data.message ?? "CSV imported."} Rows: ${data.totalRows ?? 0}, valid: ${data.validRows ?? 0}, users: ${data.upsertedUsers ?? 0}, class codes: ${data.provisionedClassCodes ?? 0}, skipped: ${data.skippedInvalid ?? 0}, failed users: ${data.failedUsers ?? 0}.`,
      );
      await loadUsers();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import CSV.");
    } finally {
      setImportingCsv(false);
    }
  }

  async function loadUserClasses(user: RegisteredUser) {
    setUserLoading(user.userId, true);
    setUserStatus(user.userId, {});
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/classes`, {
        method: "GET",
      });
      const data = (await response.json()) as { classes?: UserVaultClass[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load classes.");
      }
      const classes = data.classes ?? [];
      setUserClasses((current) => ({ ...current, [user.userId]: classes }));
      updateUserCounts(user.userId, classes);
    } catch (err) {
      setUserStatus(user.userId, {
        error: err instanceof Error ? err.message : "Failed to load classes.",
      });
    } finally {
      setUserLoading(user.userId, false);
    }
  }

  async function toggleUserClasses(user: RegisteredUser) {
    const nextExpanded = expandedUserId === user.userId ? null : user.userId;
    setExpandedUserId(nextExpanded);
    if (nextExpanded && !userClasses[user.userId]) {
      await loadUserClasses(user);
    }
  }

  async function addUserClasses(event: FormEvent, user: RegisteredUser) {
    event.preventDefault();
    const requestedCodes = parseMultiValueInput(classInputs[user.userId] ?? "");
    if (requestedCodes.length === 0) {
      setUserStatus(user.userId, { error: "Enter at least one class code." });
      return;
    }

    setUserLoading(user.userId, true);
    setUserStatus(user.userId, {});
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCodes: requestedCodes }),
      });
      const data = (await response.json()) as {
        classes?: UserVaultClass[];
        pendingVideoIds?: string[];
        addedCount?: number;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add classes.");
      }

      const classes = data.classes ?? [];
      setUserClasses((current) => ({ ...current, [user.userId]: classes }));
      updateUserCounts(user.userId, classes);
      setClassInputs((current) => ({ ...current, [user.userId]: "" }));
      const pendingCount = data.pendingVideoIds?.length ?? 0;
      setUserStatus(user.userId, {
        message:
          pendingCount > 0
            ? `${data.message ?? "Updated."} ${pendingCount} class(es) are pending video availability.`
            : `${data.message ?? "Updated."} Added ${data.addedCount ?? 0} new class(es).`,
      });
    } catch (err) {
      setUserStatus(user.userId, {
        error: err instanceof Error ? err.message : "Failed to add classes.",
      });
    } finally {
      setUserLoading(user.userId, false);
    }
  }

  async function removeUserClass(user: RegisteredUser, packageId: string) {
    if (!window.confirm(`Remove this class from ${user.email}?`)) return;

    setUserLoading(user.userId, true);
    setUserStatus(user.userId, {});
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.userId)}/classes/${encodeURIComponent(packageId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { classes?: UserVaultClass[]; error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to remove class.");
      }
      const classes = data.classes ?? [];
      setUserClasses((current) => ({ ...current, [user.userId]: classes }));
      updateUserCounts(user.userId, classes);
      setUserStatus(user.userId, { message: data.message ?? "Class removed." });
    } catch (err) {
      setUserStatus(user.userId, {
        error: err instanceof Error ? err.message : "Failed to remove class.",
      });
    } finally {
      setUserLoading(user.userId, false);
    }
  }

  async function removeUser(user: RegisteredUser) {
    if (!window.confirm(`Remove ${user.email} and all of their classes?`)) return;

    setUserLoading(user.userId, true);
    setUserStatus(user.userId, {});
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to remove participant.");
      }
      setUsers((current) => current.filter((item) => item.userId !== user.userId));
      setUserClasses((current) => {
        const next = { ...current };
        delete next[user.userId];
        return next;
      });
      if (expandedUserId === user.userId) setExpandedUserId(null);
      setRemoveAllMessage(data.message ?? "Participant removed.");
      setRemoveAllError(null);
    } catch (err) {
      setUserStatus(user.userId, {
        error: err instanceof Error ? err.message : "Failed to remove participant.",
      });
    } finally {
      setUserLoading(user.userId, false);
    }
  }

  async function removeAllUsers() {
    const phrase = "DELETE ALL USERS";
    const confirmation = window.prompt(`Type "${phrase}" to permanently remove all registered users.`);
    if (confirmation !== phrase) {
      setRemoveAllMessage(null);
      setRemoveAllError("Bulk delete cancelled.");
      return;
    }

    setRemovingAllUsers(true);
    setRemoveAllMessage(null);
    setRemoveAllError(null);

    try {
      const response = await fetch("/api/admin/users/register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_ALL_USERS" }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to remove users.");
      }
      setRemoveAllMessage(data.message ?? "All users removed.");
      setUsers([]);
    } catch (err) {
      setRemoveAllError(err instanceof Error ? err.message : "Failed to remove users.");
    } finally {
      setRemovingAllUsers(false);
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
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#6a7dab]">
            CSV Import to Registrants
          </p>
          <p className="mt-1 text-sm text-[#4a5f93]">
            Upload the registrants CSV and bulk import into the registered user
            list. Each row uses <code>class_code</code> for provisioning.
          </p>
        </div>

        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={importRegistrantsCsv}>
          <input
            accept=".csv,text/csv"
            className="field max-w-xl"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImportFile(file);
              setImportMessage(null);
              setImportError(null);
            }}
            type="file"
          />
          <button
            className="btn-primary w-fit px-4 py-2 text-sm"
            disabled={importingCsv}
            type="submit"
          >
            {importingCsv ? "Importing..." : "Import CSV"}
          </button>
        </form>

        {importMessage ? (
          <p className="mt-3 text-sm text-emerald-600">{importMessage}</p>
        ) : null}
        {importError ? <p className="mt-3 text-sm text-red-600">{importError}</p> : null}
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
            disabled={loadingUsers || removingAllUsers}
            onClick={() => void loadUsers()}
            type="button"
          >
            {loadingUsers ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingUsers || removingAllUsers || users.length === 0}
            onClick={() => void removeAllUsers()}
            type="button"
          >
            {removingAllUsers ? "Removing..." : "Remove All Users"}
          </button>
        </div>
        {removeAllMessage ? <p className="mt-3 text-sm text-emerald-600">{removeAllMessage}</p> : null}
        {removeAllError ? <p className="mt-3 text-sm text-red-600">{removeAllError}</p> : null}

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[#6a7dab]">
              <tr>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("email")} type="button">
                    Email{sortLabel("email")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("vault")} type="button">
                    Vault{sortLabel("vault")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("classes")} type="button">
                    Classes{sortLabel("classes")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("videos")} type="button">
                    Videos{sortLabel("videos")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("created")} type="button">
                    Created{sortLabel("created")}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button className="font-semibold hover:text-[#1c64f2]" onClick={() => changeSort("lastProvisioned")} type="button">
                    Last Provisioned{sortLabel("lastProvisioned")}
                  </button>
                </th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => {
                const expanded = expandedUserId === user.userId;
                const classes = userClasses[user.userId] ?? [];
                const isBusy = Boolean(userActionLoading[user.userId]);

                return (
                  <Fragment key={user.userId}>
                    <tr className="border-t border-[#e3eaf8]">
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
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="rounded-lg border border-[#d8e1f5] bg-white px-2.5 py-1.5 text-xs text-[#00194c] hover:border-[#1c64f2] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isBusy}
                            onClick={() => void toggleUserClasses(user)}
                            type="button"
                          >
                            {expanded ? "Hide Classes" : "Edit Classes"}
                          </button>
                          <button
                            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isBusy || removingAllUsers}
                            onClick={() => void removeUser(user)}
                            type="button"
                          >
                            {isBusy ? "Working..." : "Remove"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-[#e3eaf8] bg-[#f8fbff]">
                        <td className="px-2 py-3" colSpan={7}>
                          <div className="space-y-3">
                            <form
                              className="flex flex-wrap items-center gap-2"
                              onSubmit={(event) => void addUserClasses(event, user)}
                            >
                              <input
                                className="field min-w-64 flex-1"
                                placeholder="Add class codes, comma or new line"
                                value={classInputs[user.userId] ?? ""}
                                onChange={(event) =>
                                  setClassInputs((current) => ({
                                    ...current,
                                    [user.userId]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="btn-primary px-3 py-2 text-xs"
                                disabled={isBusy}
                                type="submit"
                              >
                                Add Classes
                              </button>
                              <button
                                className="rounded-lg border border-[#d8e1f5] bg-white px-3 py-2 text-xs text-[#00194c] hover:border-[#1c64f2]"
                                disabled={isBusy}
                                onClick={() => void loadUserClasses(user)}
                                type="button"
                              >
                                Refresh Classes
                              </button>
                            </form>

                            {userActionMessage[user.userId] ? (
                              <p className="text-sm text-emerald-600">{userActionMessage[user.userId]}</p>
                            ) : null}
                            {userActionError[user.userId] ? (
                              <p className="text-sm text-red-600">{userActionError[user.userId]}</p>
                            ) : null}

                            {classes.length > 0 ? (
                              <div className="overflow-x-auto rounded-xl border border-[#d8e1f5] bg-white">
                                <table className="min-w-full text-left text-xs">
                                  <thead className="text-[#6a7dab]">
                                    <tr>
                                      <th className="px-2 py-2">Code</th>
                                      <th className="px-2 py-2">Title</th>
                                      <th className="px-2 py-2">Date</th>
                                      <th className="px-2 py-2">Videos</th>
                                      <th className="px-2 py-2">Assets</th>
                                      <th className="px-2 py-2">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {classes.map((item) => (
                                      <tr className="border-t border-[#e3eaf8]" key={item.packageId}>
                                        <td className="px-2 py-2 font-semibold">{item.classCode ?? "-"}</td>
                                        <td className="px-2 py-2">{item.title}</td>
                                        <td className="px-2 py-2">
                                          {item.classDate ?? item.createdAt.slice(0, 10)}
                                        </td>
                                        <td className="px-2 py-2">{item.videoCount}</td>
                                        <td className="px-2 py-2">{item.assetCount}</td>
                                        <td className="px-2 py-2">
                                          <button
                                            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={isBusy}
                                            onClick={() => void removeUserClass(user, item.packageId)}
                                            type="button"
                                          >
                                            Remove
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="rounded-xl border border-[#d8e1f5] bg-white px-3 py-2 text-sm text-[#4a5f93]">
                                No classes assigned.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
