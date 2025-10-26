"use client";

import React, { useState } from "react";

export default function AdminTransactions({
  items,
}: {
  items: Array<any>;
}) {
  const [inspect, setInspect] = useState<any | null>(null);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-3 py-2">Trip</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className={`border-t hover:bg-gray-50 ${t.suspicious ? "bg-red-50" : ""}`}>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{t.fromLabel} → {t.toLabel}</div>
                  <div className="text-xs text-gray-500">{t.id}</div>
                </td>
                <td className="px-3 py-2 text-gray-700">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-gray-700">{t.seatsTaken}{t.seatsCapacity ? `/${t.seatsCapacity}` : ""}</td>
                <td className="px-3 py-2 text-gray-700">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((t.grossCents||0)/100)}</td>
                <td className="px-3 py-2 text-gray-700">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((t.netCents||0)/100)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setInspect(t)} className="rounded border px-2 py-1 text-xs bg-white">Inspect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inspect ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInspect(null)} />
          <div className="relative max-w-xl w-full bg-white rounded shadow-lg p-6">
            <h3 className="text-lg font-semibold">Transaction {inspect.id}</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div><strong>From:</strong> {inspect.fromLabel}</div>
              <div><strong>To:</strong> {inspect.toLabel}</div>
              <div><strong>Created:</strong> {new Date(inspect.createdAt).toLocaleString()}</div>
              <div><strong>Seats taken:</strong> {inspect.seatsTaken}</div>
              <div><strong>Price (cents):</strong> {inspect.priceCents ?? "-"}</div>
              <div><strong>Gross:</strong> {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((inspect.grossCents||0)/100)}</div>
              <div><strong>Net:</strong> {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((inspect.netCents||0)/100)}</div>
              <div><strong>Suspicious:</strong> {inspect.suspicious ? "Yes" : "No"}</div>
              <div className="mt-3">
                <details className="text-xs">
                  <summary className="cursor-pointer">Raw ride object</summary>
                  <pre className="mt-2 max-h-60 overflow-auto text-xs bg-gray-100 p-2 rounded">{JSON.stringify(inspect.raw, null, 2)}</pre>
                </details>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setInspect(null)} className="px-3 py-1 rounded border">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
