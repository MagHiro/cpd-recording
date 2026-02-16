"use client";

import { FormEvent, useState } from "react";

export function AdminManualRegisterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        email?: string;
        vaultSlug?: string;
        created?: boolean;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to register user.");
      }

      setMessage(data.message ?? `User registered: ${data.email}`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-[#d8e1f5] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#6a7dab]">Manual Registration</p>
          <p className="mt-1 text-sm text-[#4a5f93]">Create vault access manually by customer email.</p>
        </div>
      </div>

      <form className="mt-3 flex flex-wrap gap-2" onSubmit={submit}>
        <input
          className="field min-w-[260px] flex-1"
          placeholder="customer@example.com"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="btn-primary px-4 py-2 text-sm" disabled={loading} type="submit">
          {loading ? "Registering..." : "Register user"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
