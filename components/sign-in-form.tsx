"use client";

import { FormEvent, useState } from "react";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to request code.");
      }

      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Login failed.");
      }

      window.location.href = "/vault";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-md w-full">
      <h1 className="text-3xl font-semibold tracking-tight text-[#00194c]">
        Access Your CPD Portal
      </h1>
      <p className="mt-3 text-sm text-[#4a5f93]">
        Sign in using the email address you used to register for your CPD
        session.
      </p>

      {step === "email" ? (
        <form className="mt-8 space-y-4" onSubmit={requestCode}>
          <label className="block text-sm text-[#24407a]" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <button
            className="btn-primary w-full"
            disabled={loading}
            type="submit"
          >
            {loading ? "Sending code..." : "Send login code"}
          </button>
        </form>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={verifyCode}>
          <label className="block text-sm text-[#24407a]" htmlFor="code">
            6-digit code
          </label>
          <input
            id="code"
            type="text"
            required
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field"
            placeholder="123456"
            autoComplete="one-time-code"
            maxLength={6}
          />
          <button
            className="btn-primary w-full"
            disabled={loading}
            type="submit"
          >
            {loading ? "Verifying..." : "Sign in"}
          </button>
          <button
            className="w-full rounded-xl border border-[#d8e1f5] px-4 py-3 text-sm text-[#24407a] hover:border-[#f39c12]"
            disabled={loading}
            onClick={() => setStep("email")}
            type="button"
          >
            Change email
          </button>
        </form>
      )}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
