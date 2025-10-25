"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

// ---------- Íconos SVG locales ----------
function HomeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11L12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function TripIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 13l2-5c.4-1 1-2 2.5-2h9c1.5 0 2.1 1 2.5 2l2 5" />
      <path d="M5 13h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 13v4c0 .6.4 1 1 1h1" />
      <path d="M21 13v4c0 .6-.4 1-1 1h-1" />
    </svg>
  );
}

function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}
// -----------------------------------------

export default function Navbar() {
  const pathname = usePathname();

  // 1. Mostrar navbar SOLO en estas rutas
  const visibleOn = ["/home", "/maps", "/user"];
  const shouldShow = visibleOn.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (!shouldShow) {
    return null;
  }

  // 2. Botón reusable con icon + label
  const NavButton = ({
    href,
    label,
    Icon,
  }: {
    href: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }) => {
    const isActive =
      pathname === href ||
      (href !== "/home" && pathname.startsWith(href));

    return (
      <Link href={href} className="group block px-3 py-2 text-center">
        <div
          className={[
            "mx-auto flex w-fit items-center gap-2 rounded-lg px-3 py-1 text-[13px] font-semibold text-white transition-all",

            // hover (si NO es la activa)
            !isActive
              ? "group-hover:bg-white/20 group-hover:ring group-hover:ring-white/30 group-hover:backdrop-blur-sm"
              : "",

            // estado activa
            isActive
              ? "bg-white/20 ring ring-white/30 backdrop-blur-sm"
              : "",
          ].join(" ")}
        >
          <Icon className="w-4 h-4" />
          <span className="leading-none">{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full bg-gradient-to-r from-black/60 to-red-600/60 backdrop-blur-md text-white shadow-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-14 grid-cols-3 items-center">
          <NavButton href="/home" label="Inicio" Icon={HomeIcon} />
          <NavButton href="/maps" label="Viajes" Icon={TripIcon} />
          <NavButton href="/user" label="Usuario" Icon={UserIcon} />
        </div>
      </div>
    </nav>
  );
}
