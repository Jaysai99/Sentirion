"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/sentiment", label: "Sentiment" },
  { href: "/markets", label: "Markets" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex min-h-14 items-center justify-between border-b border-white/8 bg-[#060d0b]/88 px-4 backdrop-blur-md sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-[#b8f36b]" />
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d7dfda]">
            Sentirion
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[#76867f]">
            By Dekalb Capital Management LLC
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition sm:px-4 sm:text-[11px] ${
                active
                  ? "bg-[#b8f36b] text-[#09110f]"
                  : "text-[#76867f] hover:bg-white/8 hover:text-[#d5ddd7]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
