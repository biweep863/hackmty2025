"use client";
import React, { useState } from "react";
import Image from "next/image";
import logo from "../inicio/Logo.png";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createUser = api.register.UserRegister.useMutation();
  const saveString = api.register.saveString.useMutation();
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus(null);
    if (!name || !email || !password) {
      setStatus("Por favor completa todos los campos.");
      return;
    }
    if (password !== confirm) {
      setStatus("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // Demo: guardar en localStorage
      const payload = { email};
      localStorage.setItem("user", JSON.stringify(payload));
      setStatus("Cuenta creada (demo). Revisa la consola o localStorage.");
      console.log("Registro demo:", payload);
    } catch (err) {
      console.error(err);
      setStatus("Error al registrar. Revisa la consola.");
    } finally {
      createUser.mutateAsync({ email, name, password });
      saveString.mutate(email);
      setLoading(false);
      router.push("/user");
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-r from-black to-red-600 flex items-center py-16">
      <div className="max-w-lg mx-auto p-6 animate-fade-up">
        <div className="mb-6 flex justify-center animate-pop">
          <Image src={logo} alt="Logo" width={96} height={96} className="object-contain bg-transparent" />
        </div>

        <h1 className="text-2xl heading-1 font-bold mb-3 text-white text-center">Crea tu cuenta</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="ui-input bg-white text-black placeholder-gray-500"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            type="email"
            className="ui-input bg-white text-black placeholder-gray-500"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            className="ui-input bg-white text-black placeholder-gray-500"
          />

          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar contraseña"
            type="password"
            className="ui-input bg-white text-black placeholder-gray-500"
          />

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="primary-btn px-6 py-2 bg-linear-to-r from-red-600 to-red-500 text-white rounded-xl shadow-lg"
            >
              {loading ? "Registrando..." : "Crear cuenta"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-200">¿Ya tienes cuenta?</p>
            <Link href="/inicio" className="text-white font-semibold underline mt-1 inline-block">Inicia Sesión</Link>
          </div>
        </form>

        {status && <p className="mt-4 text-sm text-white text-center">{status}</p>}

        <div className="mt-8 text-center text-xs text-gray-200">Consulta el <span className="font-bold">Aviso de Privacidad</span></div>
      </div>
    </div>
  );
}
