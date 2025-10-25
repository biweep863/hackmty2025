"use client";

import { useState } from "react";

export default function AdminTabs({
  summary,
  sales,
  security,
}: {
  summary: React.ReactNode;
  sales: React.ReactNode;
  security: React.ReactNode;
}) {
  const tabs = [
    { key: "summary", label: "Summary", node: summary },
    { key: "sales", label: "Sales", node: sales },
    { key: "security", label: "Security", node: security },
  ];
  const [active, setActive] = useState("summary");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded px-3 py-1.5 text-sm ${
              active === t.key
                ? "bg-white/10 text-white"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            } border border-gray-700`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.key === active)?.node}</div>
    </div>
  );
}
