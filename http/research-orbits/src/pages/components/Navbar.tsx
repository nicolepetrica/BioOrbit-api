// src/components/Navbar.tsx
import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { label: "Explore Trends", href: "#trends", type: "hash" },
    { label: "Saved Papers", href: "/saved", type: "route" },
    { label: "Upload", href: "#upload", type: "hash" },
    { label: "Ask AI", href: "#ask", type: "hash" },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 bg-[#0c0814]/70 backdrop-blur supports-[backdrop-filter]:bg-[#0c0814]/60">
        <div className="px-[40px]">
          <div className="mx-auto max-w-[1800px] flex h-16 items-center justify-between">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/icons/logo.svg"
                alt="Research Orbits"
                className="select-none h-[clamp(20px,2vw,32px)] w-[clamp(20px,2vw,32px)]"
                draggable={false}
              />
              <span className="font-extrabold tracking-tight text-white text-[clamp(14px,1.3vw,18px)]">
                Research Orbits
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((it) =>
                it.type === "route" ? (
                  <Link
                    key={it.href}
                    to={it.href}
                    className="font-medium text-[#C9B6F7] text-[clamp(14px,1.2vw,18px)] transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                  >
                    {it.label}
                  </Link>
                ) : (
                  <a
                    key={it.href}
                    href={it.href}
                    className="font-medium text-[#C9B6F7] text-[clamp(14px,1.2vw,18px)] transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                  >
                    {it.label}
                  </a>
                )
              )}
            </div>

            {/* Mobile Toggle */}
            <button
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white/85 hover:bg-white/10"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="px-[40px] pb-3 md:hidden">
            <div className="flex flex-col py-2">
              {navItems.map((it) =>
                it.type === "route" ? (
                  <Link
                    key={it.href}
                    to={it.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 font-medium text-[#C9B6F7] text-[clamp(15px,4.5vw,18px)] hover:bg-white/10 hover:text-white transition-all"
                  >
                    {it.label}
                  </Link>
                ) : (
                  <a
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 font-medium text-[#C9B6F7] text-[clamp(15px,4.5vw,18px)] hover:bg-white/10 hover:text-white transition-all"
                  >
                    {it.label}
                  </a>
                )
              )}
            </div>
          </div>
        )}
      </nav>

      <div aria-hidden className="h-16" />
    </>
  );
}
