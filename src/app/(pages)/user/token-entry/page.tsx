"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function TokenEntryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Prefill token if returned from Banorte
    const t = params.get("token");
    const s = params.get("state");
    if (s) {
      try {
        // persist state to sessionStorage so verification can check it
        sessionStorage.setItem("banorte_state", s);
      } catch {}
    }
    if (t) setTokenInput(t);
  }, [params]);

  const generateAndGo = () => {
    // create state and redirect to banorte-simulate (link-banorte triggers state too, but allow here too)
    const state = Math.random().toString(36).slice(2, 10);
    try {
      sessionStorage.setItem("banorte_state", state);
    } catch {}
    const returnUrl = encodeURIComponent("/user/token-entry");
    router.push(
      `/user/banorte-simulate?state=${state}&return_url=${returnUrl}`,
    );
  };

  const verify = () => {
    setChecking(true);
    setMessage(null);
    setTimeout(() => {
      const stored =
        sessionStorage.getItem("banorte_state") ??
        localStorage.getItem("banorte_state");
      if (!stored) {
        setMessage(
          "No se encontró el estado guardado. Asegúrate de generar el código desde esta pestaña.",
        );
        setChecking(false);
        return;
      }
      // basic format check
      if (!/^\d{6}$/.test(tokenInput)) {
        setMessage("Token inválido: debe ser un código de 6 dígitos (demo).");
        setChecking(false);
        return;
      }

      // success
      try {
        localStorage.setItem("demo_banorte_linked", "true");
        localStorage.setItem("banorte_token", tokenInput);
        localStorage.removeItem("banorte_state");
        sessionStorage.removeItem("banorte_state");
      } catch {}
      setMessage("¡Vinculado! Redirigiendo...");
      setTimeout(() => router.push("/rider"), 900);
    }, 700);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="animate-pop w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="heading-1 mb-2 text-2xl font-semibold">
          Introduce el código
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Pulsa el botón Generar código de acceso desde el app de Banorte.
        </p>

        <div className="space-y-3">
          <div className="rounded-md bg-gray-50 p-4">
            <label className="text-xs text-gray-500">Código (6 dígitos)</label>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="ui-input token-box mt-2 w-full text-center text-2xl"
              placeholder="— — — — — —"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={generateAndGo}
              className="primary-btn flex-1 rounded-lg bg-[#e60012] px-4 py-3 text-white"
            >
              Generar código
            </button>
            <button
              onClick={verify}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              Verificar
            </button>
          </div>

          {checking && (
            <div className="text-sm text-gray-600">Verificando...</div>
          )}
          {message && <div className="text-sm text-gray-700">{message}</div>}
        </div>
      </div>
    </div>
  );
}
