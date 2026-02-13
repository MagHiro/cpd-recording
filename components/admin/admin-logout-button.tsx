"use client";

import { useState } from "react";

export function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="rounded-lg border border-[#d8e1f5] bg-white px-4 py-2 text-sm text-[#00194c] hover:border-[#f39c12]"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/admin/auth/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
      type="button"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
