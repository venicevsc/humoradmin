"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Stats" },
  { href: "/users", label: "Users" },
  { href: "/media", label: "Media" },
  { href: "/votes", label: "Votes" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
