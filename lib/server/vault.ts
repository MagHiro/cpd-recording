import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { getVaultByUserId } from "@/lib/server/db";

export async function requireVaultView() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/");
  }

  const vault = await getVaultByUserId(user.userId);
  if (!vault) {
    redirect("/");
  }

  return vault;
}

export function shortMonth(dateString?: string | null): string {
  if (!dateString) {
    return "-";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("en-US", { month: "short" });
}
