"use client";

import React, { useState } from "react";
import Image from "next/image";
import logo from "./Logo.png";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export default function AuthPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const saveString = api.register.saveString.useMutation();
  const isUser = api.register.isUser.useQuery(identifier);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    // setStatus(null);
    if (!identifier || !password) {
      setStatus("Por favor completa usuario/email y contraseña.");
      return;
    }
    if(!isUser.data) {
      setStatus("Usuario no encontrado. Por favor regístrate.");
      return;
    }
    setLoading(true);
    try {
    saveString.mutate(identifier);
    } catch (err) {
      console.error(err);
      setStatus("Error al enviar. Revisa la consola.");
    } finally {
      router.push("/user");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-r from-black to-red-600 flex items-center py-16">
      <div className="max-w-lg mx-auto p-6 animate-fade-up">
        <div className="mb-6 flex justify-center animate-pop">
          <Image src={logo} alt="Logo" width={96} height={96} className="object-contain bg-transparent" />
        </div>

        <h1 className="text-3xl heading-1 font-bold mb-3 text-white text-center">Inicia Sesión</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Usuario o correo"
              className="ui-input bg-white text-black placeholder-gray-500"
            />
          </label>

          <label className="flex flex-col">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              type="password"
              className="ui-input bg-white text-black placeholder-gray-500"
            />
          </label>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="primary-btn px-6 py-2 bg-linear-to-r from-red-600 to-red-500 text-white rounded-xl shadow-lg"
            >
              {loading ? "Enviando..." : "Iniciar Sesión"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-200">¿Aún no tienes una cuenta?</p>
            <Link href="/register" className="text-white font-semibold underline mt-1 inline-block">Regístrate</Link>
          </div>
        </form>

        {status && <p className="mt-4 text-sm text-white text-center">{status}</p>}

        <div className="mt-8 text-center text-xs text-gray-200">Consulta el <span className="font-bold">Aviso de Privacidad</span></div>
      </div>
    </div>
  );
}