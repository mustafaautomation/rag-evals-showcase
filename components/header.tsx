"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Industries" },
  { href: "/overview", label: "Overview" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className="wrap">
        <Link className="brand" href="/">
          <small>Quvantic</small>
          <strong>RAG evals</strong>
        </Link>
        <nav className="nav" aria-label="Primary">
          <span className="demo-pill">Synthetic demo</span>
          {LINKS.map((link) => {
            const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
          <a href="https://github.com/mustafaautomation" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
