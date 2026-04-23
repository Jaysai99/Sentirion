"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/sentiment", label: "Sentiment" },
  { href: "/markets", label: "Markets" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex h-10 items-center justify-between border-b border-white/8 bg-[#060d0b]/90 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-[#b8f36b]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#76867f]">
          Sentirion
        </span>
      </div>
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
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
