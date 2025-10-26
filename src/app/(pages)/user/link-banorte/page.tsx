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
  router.push(`/user/banorte-simulate?state=${state}&return_url=${returnUrl}`);
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
  <div className="min-h-screen bg-linear-to-b from-white to-gray-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl p-10 grid grid-cols-1 md:grid-cols-2 gap-8 animate-pop">
        <div className="flex flex-col justify-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="#e60012" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div className="text-sm text-gray-500">Proceso rápido</div>
              <div className="text-xl font-semibold heading-1">Vincular Banorte (sandbox)</div>
            </div>
          </div>

          <p className="text-gray-600 mb-6">Para completar tu registro necesitas verificar tu cuenta con Banorte. Te llevaremos a una pantalla simulada donde iniciarás sesión y obtendrás un token que deberás aceptar para volver a la app.</p>

          <ol className="list-decimal pl-5 space-y-3 text-gray-700">
            <li>Inicia la verificación con Banorte.</li>
            <li>Autoriza en la app simulada de Banorte.</li>
            <li>Copia/acepta el token y vuelve a la app: quedas vinculado.</li>
          </ol>

          <div className="mt-8 flex gap-3">
            <button onClick={doLink} className="px-5 py-3 bg-[#e60012] text-white rounded-lg primary-btn shadow">Iniciar verificación</button>
            <button onClick={() => router.back()} className="px-4 py-3 bg-white border border-gray-200 rounded-lg">Volver</button>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-center">
          <div className="w-full max-w-sm p-4 bg-linear-to-b from-red-50 to-white rounded-xl border border-red-100 shadow-sm text-center">
            <div className="text-sm text-red-700">Banorte (sandbox)</div>
            <div className="mt-4">
              <div className="mx-auto w-28 h-12 flex items-center justify-center text-red-600 font-bold">Banorte</div>
            </div>
            <div className="mt-6 text-sm text-gray-600">Este es un demo visual de la experiencia — no se envían datos reales.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
