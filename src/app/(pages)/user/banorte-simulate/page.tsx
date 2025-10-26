"use client";

import React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

function random6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function BanorteSimulate() {
  const params = useSearchParams();
  const router = useRouter();
  const state = params.get("state") ?? undefined;
  const returnUrl = params.get("return_url") ? decodeURIComponent(params.get("return_url")!) : "/";
  const [clientId, setClientId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [previewToken, setPreviewToken] = React.useState<string | null>(null);
  const [authing, setAuthing] = React.useState(false);

  const doAuthorize = () => {
    if (!clientId || clientId.trim().length < 3) {
      setError("Ingresa tu tarjeta, cuenta o número de cliente");
      return null;
    }
    setError(null);
    setAuthing(true);
    const token = random6();
    try {
      localStorage.setItem("banorte_last_token", token);
      // store the provided clientId in demo storage (not real)
      localStorage.setItem("banorte_last_client", clientId);
    } catch {}
    setPreviewToken(token);
    // show token briefly and auth animation then redirect so user can see it
    setTimeout(() => {
      setAuthing(false);
      router.push(`${returnUrl}?state=${state}&token=${token}`);
    }, 2000);
    return token;
  };

  return (
    <div className="min-h-screen bg-[#ea2031] flex items-center justify-center px-6 py-12 bg-texture">
      <div className="w-full max-w-md text-white">
        <div className="flex flex-col items-center">
          <Image src="/LogoBanorte.png" alt="Banorte" className="mb-4 object-contain" width={250} height={80} priority />
          <div className="text-2xl font-semibold">¡Bienvenido a Banorte Móvil!</div>

          {previewToken ? (
            <div className="mt-6 text-center w-full">
              <div className="text-sm text-white/90">Tu código</div>
              <div className="token-box text-5xl font-semibold mt-2 text-white bg-white/10 inline-block px-8 py-4 rounded-lg">{previewToken}</div>
              <div className="mt-2 text-sm text-white/80">{authing ? "Redirigiendo…" : "Serás redirigido a la app"}</div>
            </div>
          ) : (
            <div className="mt-6 w-full">
              <div className="bg-white p-4 rounded-md shadow-sm">
                <div className="text-base font-bold text-gray-800">¿Eres cliente Banorte?</div>
                <div className="text-[12px] text-gray-700">Ingresa tu tarjeta, cuenta o número de cliente <span className="font-bold">para activar Banorte Móvil</span></div>
                <input
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setError(null); }}
                  placeholder="Tarjeta, cuenta o número de cliente"
              className="mt-5 w-full bg-transparent text-xs text-gray-700 placeholder-gray-700 border-0 px-0 py-1 focus:outline-none"
                />
                {error ? <div className="text-sm text-red-600 mt-2">{error}</div> : null}

                <hr className="my-4 border-t border-gray-200" />
                <div className="text-xs text-gray-600 text-left">16 dígitos tarjeta · 10 dígitos cuenta · 8 dígitos num. de cliente</div>

                <div className="mt-4 flex items-center gap-3 justify-center">
                  <button onClick={doAuthorize} className="px-45 py-2 bg-gray-500 text-white rounded-md font-medium">Aceptar</button>
                </div>
                {authing && <div className="mt-3 text-sm text-gray-700">Autenticando…</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
