"use client";

import React, { useState } from "react";

/**
 * Formulario simple de login (frontend-only)
 * - Campos: usuario/email y contraseña
 * - Botón "Enviar"
 * - Si `endpoint` está definido (campo en el formulario), hará POST JSON a ese endpoint
 * - Si no hay endpoint, guarda las credenciales (solo para demo) en localStorage bajo la key `frontend_last_credentials`
 * Nota: esto NO es seguro para producción. Es solo UI/UX frontend.
 */

export default function AuthPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus(null);
    if (!identifier || !password) {
      setStatus("Por favor completa usuario/email y contraseña.");
      return;
    }

    setLoading(true);
    try {
      if (endpoint) {
        // intenta enviar al endpoint dado
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const text = await (res.text());
        if (!res.ok) {
          setStatus(`Error del endpoint: ${res.status} ${text}`);
        } else {
          setStatus(`Enviado al endpoint. Respuesta: ${text}`);
        }
      } else {
        // sin endpoint: demo local (no seguro)
        const payload = { identifier, password, sentAt: new Date().toISOString() };
        localStorage.setItem("frontend_last_credentials", JSON.stringify(payload));
        console.log("Credenciales guardadas localmente (demo):", payload);
        setStatus("Enviado localmente (demo). Revisa la consola o localStorage.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error al enviar. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  }

  function handleClearLocal() {
    localStorage.removeItem("frontend_last_credentials");
    setStatus("LocalStorage limpiado.");
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Login rápido (solo frontend)</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col">
          <span className="text-sm text-gray-700">Usuario o email</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="usuario@ejemplo.com o user123"
            className="border rounded p-2"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-700">Contraseña</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            className="border rounded p-2"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-700">Endpoint (opcional)</span>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://mi-api.local/login"
            className="border rounded p-2"
          />
          <span className="text-xs text-gray-500 mt-1">Si lo dejas vacío se guardará localmente (demo).</span>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>
          <button type="button" onClick={handleClearLocal} className="px-4 py-2 bg-gray-200 rounded">
            Limpiar local (demo)
          </button>
        </div>
      </form>

      {status && <p className="mt-4 text-sm text-gray-700">{status}</p>}

      <div className="mt-6 text-xs text-gray-500">
        <p>Nota: Esto es solo interfaz cliente para pruebas. No envíes credenciales reales a endpoints no confiables.</p>
      </div>
    </div>
  );
}