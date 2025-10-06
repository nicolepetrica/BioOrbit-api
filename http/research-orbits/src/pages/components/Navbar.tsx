// src/components/Navbar.tsx
import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Right-side text links (Ask AI is *not* here — it's the pill button)
  const navLinks = [
    { label: "Insights", to: "/insights" }, // adjust if you use a hash or different route
    { label: "Papers", to: "/all" },
    { label: "Saved Papers", to: "/saved" },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 bg-[#0c0814]/70 backdrop-blur supports-[backdrop-filter]:bg-[#0c0814]/60">
        <div className="px-[40px]">
          <div className="mx-auto max-w-[1800px] flex h-16 items-center justify-between">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src="./icons/logo.svg"
                alt="Bio Orbits"
                className="select-none h-[clamp(20px,2vw,32px)] w-[clamp(20px,2vw,32px)]"
                draggable={false}
              />
              <span className="font-extrabold tracking-tight text-white text-[clamp(14px,1.3vw,18px)]">
                Bio Orbits
              </span>
            </Link>

            {/* Desktop menu */}
            <div className="hidden items-center gap-6 md:flex">
              {navLinks.map((it) => (
                <Link
                  key={it.to}
                  to={it.to}
                  className="font-medium text-[#C9B6F7] text-[clamp(14px,1.2vw,18px)] transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                >
                  {it.label}
                </Link>
              ))}

              {/* Ask AI — pill button with SVG icon */}
              <Link
                to="/ask"
                className="
                  ml-2 inline-flex items-center justify-center gap-2
                  rounded-2xl px-4 py-2
                  bg-violet-300 text-slate-950 font-bold
                  shadow-[0_0_0_6px_rgba(201,182,247,0.12)_inset,0_8px_30px_rgba(201,182,247,0.18)]
                  hover:brightness-105 hover:shadow-[0_0_0_6px_rgba(201,182,247,0.18)_inset,0_10px_36px_rgba(201,182,247,0.26)]
                  transition-all
                  text-[clamp(13px,1vw,15px)]
                "
              >
                <img
                  src="./icons/askAI.svg"
                  alt=""
                  className="h-4 w-4 md:h-5 md:w-5"
                />
                Ask AI
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white/85 hover:bg-white/10"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="px-[40px] pb-3 md:hidden">
            <div className="flex flex-col py-2 gap-1">
              {navLinks.map((it) => (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 font-medium text-[#C9B6F7] text-[clamp(15px,4.5vw,18px)] hover:bg-white/10 hover:text-white transition-all"
                >
                  {it.label}
                </Link>
              ))}

              {/* Ask AI — pill button (mobile) */}
              <Link
                to="/ask"
                onClick={() => setOpen(false)}
                className="
                  mt-2 inline-flex items-center justify-center gap-2
                  rounded-2xl px-4 py-2
                  bg-violet-300 text-slate-950 font-bold
                  shadow-[0_0_0_6px_rgba(201,182,247,0.12)_inset,0_8px_30px_rgba(201,182,247,0.18)]
                  hover:brightness-105
                  transition-all
                "
              >
                <img
                  src="./icons/askAI.svg"
                  alt=""
                  className="h-4 w-4"
                />
                Ask AI
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Spacer for fixed nav */}
      <div aria-hidden className="h-16" />
    </>
  );
}
