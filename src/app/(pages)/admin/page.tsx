// src/app/admin/page.tsx
import Header from "../../_components/header";
import Footer from "../../_components/footer";
import { api } from "~/trpc/server";
import AdminTabs from "../../_components/admin-tabs";
import Sparkline from "../../_components/sparkline";

function fmtMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100,
  );
}
function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

export default async function AdminPage() {
  const [summary, trend, trips, security] = await Promise.all([
    api.admin.summary(),
    api.admin.salesTrend({ bucket: "day" }),
    api.admin.tripRevenues({ limit: 50 }),
    api.admin.securityAnomalies({ occupancyThreshold: 0.25 }),
  ]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="col-span-2">
              <div className="overflow-hidden rounded-lg border shadow-sm">
                <div className="bg-red-600 p-4">
                  <h2 className="text-lg font-semibold text-white">
                    Dashboard
                  </h2>
                </div>
                <div className="bg-white p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded border bg-white p-4">
                      <div className="text-xs text-gray-500">Trips</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">
                        {summary.tripsCount}
                      </div>
                    </div>
                    <div className="rounded border bg-white p-4">
                      <div className="text-xs text-gray-500">
                        Seats Sold / Capacity
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">
                        {summary.seatsSold}{" "}
                        <span className="text-sm text-gray-500">
                          / {summary.seatsCapacity}
                        </span>
                      </div>
                    </div>
                    <div className="rounded border bg-white p-4">
                      <div className="text-xs text-gray-500">Occupancy</div>
                      <div className="mt-1 text-2xl font-semibold text-green-600">
                        {pct(summary.occupancy)}
                      </div>
                    </div>
                    <div className="rounded border bg-white p-4">
                      <div className="text-xs text-gray-500">Gross / Net</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">
                        {fmtMoney(summary.grossCents, summary.currency)}{" "}
                        <span className="text-sm text-gray-500">
                          / {fmtMoney(summary.netCents, summary.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-800">
                      Daily Sales Trend
                    </h3>
                    <div className="rounded border bg-white p-4">
                      <Sparkline
                        series={trend.series.map((d) => ({
                          label: d.bucket,
                          value: d.netCents,
                        }))}
                        height={80}
                      />
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left text-gray-600">
                              <th className="px-3 py-2">Bucket</th>
                              <th className="px-3 py-2">Trips</th>
                              <th className="px-3 py-2">Gross</th>
                              <th className="px-3 py-2">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trend.series.map((r) => (
                              <tr
                                key={r.bucket}
                                className="border-t hover:bg-gray-50"
                              >
                                <td className="px-3 py-2 text-gray-700">
                                  {r.bucket}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {r.trips}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {fmtMoney(r.grossCents, trend.currency)}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {fmtMoney(r.netCents, trend.currency)}
                                </td>
                              </tr>
                            ))}
                            {trend.series.length === 0 && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-4 text-center text-gray-500"
                                >
                                  No data yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                  Recent Trips
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-3 py-2">Trip</th>
                        <th className="px-3 py-2">Departure</th>
                        <th className="px-3 py-2">Seats</th>
                        <th className="px-3 py-2">Gross</th>
                        <th className="px-3 py-2">Net</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((t) => (
                        <tr
                          key={t.tripId}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">
                              {t.fromLabel} → {t.toLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t.tripId}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {new Date(t.departureAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {t.seatsTaken}/{t.seatsTotal}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {fmtMoney(t.grossCents)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {fmtMoney(t.netCents)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex rounded border px-2 py-0.5 text-xs"
                              style={{
                                background: "#fff2f2",
                                color: "#c30010",
                                borderColor: "#ffd6d6",
                              }}
                            >
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {trips.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-gray-500"
                          >
                            No trips yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="overflow-hidden rounded-lg border shadow-sm">
                <div className="bg-red-600 p-3">
                  <h4 className="text-sm font-semibold text-white">Security</h4>
                </div>
                <div className="bg-white p-3">
                  <div className="mb-2 text-sm text-gray-700">
                    Recent anomalies
                  </div>
                  <div className="space-y-2">
                    {security.anomalies.slice(0, 6).map((a) => (
                      <div
                        key={`${a.tripId}-${a.type}-${a.departureAt}`}
                        className="rounded border p-2"
                      >
                        <div className="text-xs text-gray-600">{a.type}</div>
                        <div className="text-sm font-medium text-gray-900">
                          {a.route}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(a.departureAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {security.anomalies.length === 0 && (
                      <div className="text-sm text-gray-500">
                        No anomalies detected.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-800">
                  Operations
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  Useful admin actions
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button className="w-full rounded bg-red-600 py-2 text-white">
                    Export CSV (last 30d)
                  </button>
                  <button className="w-full rounded border border-red-600 py-2 text-red-600">
                    Recompute Pricing
                  </button>
                  <button className="w-full rounded bg-gray-100 py-2 text-gray-800">
                    Flag Suspicious Trips
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="mt-8">
          <Footer />
        </div>
      </div>
    </div>
  );
}
