"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerifyBanortePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = params.get("state");
    const token = params.get("token");
    try {
      const stored = localStorage.getItem("banorte_state");
      if (!state || !token) {
        setStatus("error");
        setMessage("Faltan parámetros (state o token). La verificación falló.");
        return;
      }
      if (stored !== state) {
        // Show helpful debug info to user and allow forcing demo link
        setStatus("error");
        setMessage("El estado no coincide. Posible intento inválido.");
        // attach diagnostic info to message (rendered below)
        return;
      }

      // basic format check for demo: 6 digits
      if (!/^\d{6}$/.test(token)) {
        setStatus("error");
        setMessage("Token inválido (debe ser 6 dígitos en la demo).");
        return;
      }

      // success: mark demo as linked and save token
      try {
        localStorage.setItem("demo_banorte_linked", "true");
        localStorage.setItem("banorte_token", token);
        localStorage.removeItem("banorte_state");
      } catch {}

      setStatus("ok");
      setMessage("Vinculación completada. Redirigiendo...");
      setTimeout(() => router.push("/"), 900);
    } catch {
      setStatus("error");
      setMessage("Error interno durante verificación.");
    }
  }, [params, router]);

  const forceLink = () => {
    const token = params.get("token");
    try {
      if (token) localStorage.setItem("banorte_token", token);
      localStorage.setItem("demo_banorte_linked", "true");
      localStorage.removeItem("banorte_state");
    } catch {}
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center animate-pop">
        {status === "checking" && (
          <div className="flex flex-col items-center gap-4">
            <div className="spinner" />
            <div className="text-gray-600">Verificando token...</div>
          </div>
        )}
        {status === "ok" && (
          <div className="flex flex-col items-center gap-4">
            <div className="checkmark mx-auto">
              <svg viewBox="0 0 24 24"><path d="M4 12l4 4L20 6" /></svg>
            </div>
            <div className="text-green-600 font-medium">{message}</div>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-red-600 font-medium">{message}</div>
            <div className="text-sm text-gray-600">Estado esperado (guardado): <span className="font-mono">{localStorage.getItem('banorte_state') ?? '(vacío)'}</span></div>
            <div className="text-sm text-gray-600">Estado recibido (URL): <span className="font-mono">{params.get('state') ?? '(vacío)'}</span></div>
            <div className="flex gap-3">
              <button onClick={() => router.push('/user/link-banorte')} className="px-4 py-2 bg-white border border-gray-200 rounded-md">Reintentar vinculación</button>
              <button onClick={forceLink} className="px-4 py-2 bg-[#e60012] text-white rounded-md">Forzar vinculación (demo)</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
