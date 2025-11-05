"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function LinkBanortePage() {
  const router = useRouter();

  const doLink = () => {
    try {
      // create a random state to mitigate simple forgeries (demo-only)
      const state = Math.random().toString(36).slice(2, 10);
      localStorage.setItem("banorte_state", state);
      const returnUrl = encodeURIComponent("/user/token-entry");
      // redirect to the simulated Banorte app with state and return_url
      router.push(
        `/user/banorte-simulate?state=${state}&return_url=${returnUrl}`,
      );
      return;
    } catch {
      // fallback: mark linked directly
      try {
        localStorage.setItem("demo_banorte_linked", "true");
      } catch {}
      setTimeout(() => router.push("/trips"), 400);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-white to-gray-50 px-6 py-12">
      <div className="animate-pop grid w-full max-w-3xl grid-cols-1 gap-8 rounded-2xl bg-white p-10 shadow-2xl md:grid-cols-2">
        <div className="flex flex-col justify-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg
                className="h-6 w-6 text-red-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 12h18"
                  stroke="#e60012"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm text-gray-500">Proceso rápido</div>
              <div className="heading-1 text-xl font-semibold">
                Vincular Banorte (sandbox)
              </div>
            </div>
          </div>

          <p className="mb-6 text-gray-600">
            Para completar tu registro necesitas verificar tu cuenta con
            Banorte. Te llevaremos a una pantalla simulada donde iniciarás
            sesión y obtendrás un token que deberás aceptar para volver a la
            app.
          </p>

          <ol className="list-decimal space-y-3 pl-5 text-gray-700">
            <li>Inicia la verificación con Banorte.</li>
            <li>Autoriza en la app simulada de Banorte.</li>
            <li>Copia/acepta el token y vuelve a la app: quedas vinculado.</li>
          </ol>

          <div className="mt-8 flex gap-3">
            <button
              onClick={doLink}
              className="primary-btn rounded-lg bg-[#e60012] px-5 py-3 text-white shadow"
            >
              Iniciar verificación
            </button>
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              Volver
            </button>
          </div>
        </div>

        <div className="hidden items-center justify-center md:flex">
          <div className="w-full max-w-sm rounded-xl border border-red-100 bg-linear-to-b from-red-50 to-white p-4 text-center shadow-sm">
            <div className="text-sm text-red-700">Banorte (sandbox)</div>
            <div className="mt-4">
              <div className="mx-auto flex h-12 w-28 items-center justify-center font-bold text-red-600">
                Banorte
              </div>
            </div>
            <div className="mt-6 text-sm text-gray-600">
              Este es un demo visual de la experiencia — no se envían datos
              reales.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
