"use client";

import React, { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import Loading from "~/app/_components/Loading";

export default function UserCard() {
  const email = api.register.getEmail.useQuery();
  console.log("Fetched email from user.json:", email.data);

  const { data: use, isLoading, error } = api.register.getUser.useQuery(email.data ?? "");
  if (isLoading) return <Loading />;
  const user = use || {name: "—", email: "—"};

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-md overflow-hidden shadow-md">
        <div style={{ background: "#e60012" }} className="p-4">
          <h2 className="text-lg font-bold text-white">Mi perfil</h2>
        </div>
        <div className="p-4 bg-white">
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Nombre</div>
                <div className="font-medium text-gray-800">{user.name ?? "—"}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Email</div>
                <div className="font-medium text-gray-800">{user.email ?? "—"}</div>
              </div>

            </div>
        </div>
      </div>
    </div>
  );
}
