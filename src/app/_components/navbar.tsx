"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function Navbar() {
  const pathname = usePathname();

  // Botón reutilizable
  const NavButton = ({ href, label }: { href: string; label: string }) => {
    // Definimos si este tab está "activo"
    // Puedes ajustar las rutas si quieres que /trips/123 también marque Trips como activo
    const isActive =
      pathname === href ||
      (href !== "/inicio" && pathname.startsWith(href));

    return (
      <Link
        href={href}
        className="group block px-3 py-2 text-center"
      >
        <div
          className={[
            // base: texto blanco sobre tu gradiente
            "mx-auto w-fit rounded-lg px-3 py-1 text-[13px] font-semibold text-white transition-all",

            // HOVER (solo si NO está activo):
            // mostramos la cápsula traslúcida con blur y un borde suave
            !isActive
              ? "group-hover:bg-white/20 group-hover:ring group-hover:ring-white/30 group-hover:backdrop-blur-sm"
              : "",

            // ACTIVO (permanente):
            // misma cápsula traslúcida + ring, pero fija siempre
            isActive
              ? "bg-white/20 ring ring-white/30 backdrop-blur-sm"
              : "",
          ].join(" ")}
        >
          {label}
        </div>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full bg-gradient-to-r from-black/60 to-red-600/60 backdrop-blur-md text-white shadow-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-14 grid-cols-3 items-center">
          <NavButton href="/home" label="Inicio" />
          <NavButton href="/maps" label="Viajes" />
          <NavButton href="/user" label="Usuario" />
        </div>
      </div>
    </nav>
  );
}
