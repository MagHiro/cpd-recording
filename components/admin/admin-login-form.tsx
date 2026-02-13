"use client";

import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Login failed.");
      }

      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card w-full max-w-md space-y-4" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold text-[#00194c]">Admin Login</h1>
      <p className="text-sm text-[#5b6f9f]">Use your admin credential to manage catalog entries and assignments.</p>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="field"
        placeholder="admin@example.com"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="field"
        placeholder="Enter password"
      />
      <button className="btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
