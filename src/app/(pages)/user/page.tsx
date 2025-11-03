"use client";

import { api } from "~/trpc/react";
import React, { use, useEffect, useState } from "react";
import Loading from "~/app/_components/Loading";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function UserPage() {
  const { data: session, status } = useSession();

  // local image override (allows uploading preview even without server persistence)
  const [profileImage, setProfileImage] = useState<string | null>(null);
  // profile form state (editable)
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const getEmail = api.register.getEmail.useQuery();
  const userEmail = api.register.getUser.useQuery(getEmail.data ?? "");
  const pathname = usePathname();

  useEffect(() => {
    setName("");
    setEmail("");
    getEmail.refetch();
  }, [pathname]);

  useEffect(() => {
    setName(userEmail.data?.name ?? null);
    setEmail(userEmail.data?.email ?? null);
  }, [userEmail.data]);

  // Banorte sandbox link state
  const [banorteLinked, setBanorteLinked] = useState<boolean>(false);
  const [bankData] = useState<{
    accountType: string;
    last4: string;
    balance: number;
  }>({
    accountType: "Cuenta Digital",
    last4: "5678",
    balance: 4500,
  });

  // Activity (simulated)
  const [trips] = useState([
    {
      id: "t1",
      role: "Conductor",
      title: "Monterrey → San Pedro",
      date: "2025-10-10",
      amount: 320,
    },
    {
      id: "t2",
      role: "Pasajero",
      title: "Apodaca → Tec",
      date: "2025-09-28",
      amount: -95,
    },
  ] as Array<{
    id: string;
    role: string;
    title: string;
    date: string;
    amount: number;
  }>);

  const [payments] = useState([
    {
      id: "p1",
      date: "2025-10-10",
      amount: 320,
      type: "Ingreso",
      status: "Completado",
    },
    {
      id: "p2",
      date: "2025-09-28",
      amount: -45,
      type: "Pago",
      status: "Completado",
    },
  ] as Array<{
    id: string;
    date: string;
    amount: number;
    type: string;
    status: string;
  }>);

  const [rating] = useState({ average: 4.8, count: 12 });

  useEffect(() => {
    try {
      const img = localStorage.getItem("profileImageDataUrl");
      if (img) setProfileImage(img);
    } catch {
      /* ignore */
    }

    // load persisted profile (demo) and banorte state
    try {
      const stored = localStorage.getItem("demo_profile");
      if (stored) {
        const p = JSON.parse(stored) as Partial<{
          name: string;
          phone: string;
          email: string;
        }>;
        setPhone(p.phone ?? null);
      }
      const b = localStorage.getItem("demo_banorte_linked");
      if (b === "true") setBanorteLinked(true);
    } catch {
      /* ignore */
    }
  }, []);

  const onImageSelected = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | null;
      if (result) {
        setProfileImage(result);
        try {
          localStorage.setItem("profileImageDataUrl", result);
        } catch {
          /* ignore */
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // initialize fields from session or demo values
  useEffect(() => {
    const display = session?.user as UserLike | undefined;
    setName(userEmail.data?.name ?? "");
    setEmail(userEmail.data?.email ?? "");
    setPhone((prev) => prev ?? "+52 81 1234 5678");
  }, [session]);

  const saveProfile = () => {
    const p = { name, phone, email };
    try {
      localStorage.setItem("demo_profile", JSON.stringify(p));
    } catch {
      /* ignore */
    }
    setEditMode(false);
  };

  const toggleBanorte = () => {
    const next = !banorteLinked;
    setBanorteLinked(next);
    try {
      localStorage.setItem("demo_banorte_linked", String(next));
    } catch {}
  };

  const formatCurrency = (v: number) => `\$${v.toLocaleString("es-MX")}`;

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Loading />
      </div>
    );
  }

  // allow preview: if no session, use demo placeholder so you can see the design
  type UserLike = {
    name?: string | null;
    email?: string | null;
    id?: string;
    image?: string | null;
  };
  const displayUser: UserLike = (session?.user as UserLike) ?? {
    name: userEmail.data?.name ?? "",
    email: userEmail.data?.email ?? "",
    id: "demo-000",
    image: undefined,
  };

  return (
    <div className="animate-fade-up min-h-[60vh] bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Profile header: large avatar with name and rating to the right */}
        <header className="flex items-center gap-6">
          <div className="relative">
            <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-white to-gray-100 shadow-md transition-transform duration-300 hover:scale-105">
              {profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileImage}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : displayUser.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUser.image}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-gray-700">
                  {(displayUser.name ?? "U").charAt(0)}
                </span>
              )}
            </div>
            {/* invisible file input overlay on avatar for upload (no visible label) */}
            <input
              aria-label="Subir foto de perfil"
              type="file"
              accept="image/*"
              onChange={(e) => onImageSelected(e.target.files?.[0] ?? null)}
              className="absolute inset-0 h-36 w-36 cursor-pointer rounded-full opacity-0"
            />
          </div>
          <div className="flex-1">
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-4">
                <h1 className="heading-1 text-3xl font-semibold">
                  {displayUser.name ?? "Usuario"}
                </h1>
                {banorteLinked ? (
                  <span className="badge-pulse inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="#e60012"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M8 12l2.5 2 5-5"
                        stroke="#e60012"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Verificado Banorte
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    No vinculado a Banorte
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-4">
                {!editMode ? (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="card-hover rounded-md border border-gray-200 bg-white px-4 py-2"
                    >
                      Editar perfil
                    </button>
                    <button
                      onClick={toggleBanorte}
                      className={`primary-btn rounded-md px-4 py-2 text-white ${banorteLinked ? "bg-gray-600" : "bg-[#e60012]"}`}
                    >
                      {banorteLinked
                        ? "Desvincular Banorte"
                        : "Vincular Banorte"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveProfile}
                      className="primary-btn rounded-md bg-[#e60012] px-4 py-2 text-white"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="rounded-md border border-gray-200 bg-white px-4 py-2"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center text-yellow-500">
                  <StarFilled />
                  <StarFilled />
                  <StarFilled />
                  <StarFilled />
                  <StarEmpty />
                </div>
                <div className="text-sm text-gray-600">
                  {rating.average} · {rating.count} viajes
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-col gap-2">
              {session ? (
                <button
                  onClick={() => signOut()}
                  className="primary-btn rounded-md bg-[#e60012] px-3 py-1 text-white"
                >
                  Cerrar sesión
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {/* Info area: show key user info directly instead of action buttons */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column: personal + bank card */}
          <div className="space-y-4 lg:col-span-1">
            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm text-gray-500">Datos personales</h3>
              {!editMode ? (
                <div className="mt-3">
                  <div className="text-lg font-medium">{name}</div>
                  <div className="text-sm text-gray-600">{email}</div>
                  <div className="mt-1 text-sm text-gray-600">{phone}</div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">
                      Nombre completo
                    </label>
                    <input
                      value={name ?? ""}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Teléfono</label>
                    <input
                      value={phone ?? ""}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Correo</label>
                    <input
                      value={email ?? ""}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-gray-500">
                  Datos de tu cuenta Banorte
                </h3>
              </div>
              <div className="mt-3">
                {banorteLinked ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Tipo de cuenta</div>
                    <div className="font-medium">{bankData.accountType}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      Últimos 4 dígitos
                    </div>
                    <div className="font-medium">****{bankData.last4}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      Saldo disponible
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(bankData.balance)} MXN
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    No hay vínculo activo con Banorte usa el botón Vincular
                    Banorte para probar la experiencia.
                  </div>
                )}
              </div>
            </div>

            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm text-gray-500">Soporte</h3>
              <div className="mt-2 flex flex-col gap-2">
                <button className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                  Ayuda / Contactar soporte
                </button>
                <button className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                  Cerrar todas las sesiones
                </button>
              </div>
            </div>
          </div>

          {/* Right column: activity */}
          <div className="space-y-4 lg:col-span-2">
            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Historial de viajes</h3>
                <button className="text-sm text-[#e60012]">Ver más</button>
              </div>
              <div className="mt-4 space-y-3">
                {trips.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 p-3 transition-transform duration-200 hover:-translate-y-1"
                  >
                    <div>
                      <div className="text-sm text-gray-500">
                        {t.role} — {t.title}
                      </div>
                      <div className="text-xs text-gray-400">{t.date}</div>
                    </div>
                    <div
                      className={`font-medium ${t.amount >= 0 ? "text-green-600" : "text-gray-800"}`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {formatCurrency(Math.abs(t.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Pagos / Recibos</h3>
                <button className="text-sm text-[#e60012]">
                  Ver recibos Stripe
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2">Fecha</th>
                      <th className="pb-2">Monto</th>
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2">{p.date}</td>
                        <td className="py-2">
                          {formatCurrency(Math.abs(p.amount))}
                        </td>
                        <td className="py-2">{p.type}</td>
                        <td className="py-2">
                          {p.status === "Completado" ? (
                            <span className="text-green-600">
                              ✅ {p.status}
                            </span>
                          ) : (
                            <span>🔄 {p.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card-hover rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold">Valoraciones</h3>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center text-yellow-500">
                  <StarFilled />
                  <StarFilled />
                  <StarFilled />
                  <StarFilled />
                  <StarEmpty />
                </div>
                <div>
                  <div className="text-lg font-medium">
                    {rating.average} / 5
                  </div>
                  <div className="text-sm text-gray-500">
                    Has completado {rating.count} viajes
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-sm">“Excelente conductor” — Ana</div>
                <div className="text-sm">“Muy puntual” — Luis</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StarFilled() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
      <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.574-.956L10 0l2.938 5.955 6.574.956-4.756 4.635 1.122 6.545z" />
    </svg>
  );
}

function StarEmpty() {
  return (
    <svg className="h-4 w-4 text-gray-300" viewBox="0 0 20 20">
      <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.574-.956L10 0l2.938 5.955 6.574.956-4.756 4.635 1.122 6.545z" />
    </svg>
  );
}
