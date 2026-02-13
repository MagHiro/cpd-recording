"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, FileStack, LayoutDashboard, LogOut, Settings, Video } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";

type Props = {
  email: string;
};

function navClass(active: boolean): string {
  if (active) {
    return "flex items-center gap-2 rounded-xl bg-[#1c64f2] px-4 py-3 font-semibold text-white";
  }
  return "flex items-center gap-2 rounded-xl px-4 py-3 text-[#4a5f93] hover:bg-white/80";
}

export function VaultSidebar({ email }: Props) {
  const pathname = usePathname();

  return (
    <aside className="border-r border-[#d7e3fb] bg-[#eaf1fb] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1c64f2] text-white">
          <Video size={18} />
        </div>
        <div>
          <p className="text-xl font-bold leading-none">Vault.</p>
          <p className="text-xs text-[#6a7dab]">Recording Access</p>
        </div>
      </div>

      <nav className="mt-10 space-y-2 text-sm">
        <Link href="/vault" className={navClass(pathname === "/vault")}>
          <LayoutDashboard size={16} />
          Overview
        </Link>
        <Link href="/vault/recordings" className={navClass(pathname.startsWith("/vault/recordings"))}>
          <Video size={16} />
          Recordings
        </Link>
        <Link href="/vault/materials" className={navClass(pathname.startsWith("/vault/materials"))}>
          <FileStack size={16} />
          Materials
        </Link>
        <Link href="/vault/classes" className={navClass(pathname.startsWith("/vault/classes"))}>
          <BookOpenCheck size={16} />
          Classes
        </Link>
        <Link href="/vault/settings" className={navClass(pathname.startsWith("/vault/settings"))}>
          <Settings size={16} />
          Settings
        </Link>
      </nav>

      <div className="mt-12 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.14em] text-[#b66c00]">Signed in as</p>
        <p className="mt-2 truncate text-sm font-semibold text-[#18346f]">{email}</p>
      </div>

      <div className="mt-8">
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#6a7dab]">
          <LogOut size={13} />
          Session
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
