// src/app/admin/page.tsx
import Header from "../../_components/header";
import Footer from "../../_components/footer";
import CustomLoginText from "../../_components/custom-login-text";
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
  // const session = await getServerAuthSession();
  // if (!session) {
  //   return (
  //     <div className="flex h-screen items-center justify-center">
  //       <CustomLoginText
  //         text="Please login to access the admin dashboard"
  //         label={"Login"}
  //       />
  //     </div>
  //   );
  // }
  // Optional role gate
  // if (session.user.role !== "ADMIN") { ... }

  const [summary, trend, trips, security] = await Promise.all([
    api.admin.summary(),
    api.admin.salesTrend({ bucket: "day" }),
    api.admin.tripRevenues({ limit: 50 }),
    api.admin.securityAnomalies({ occupancyThreshold: 0.25 }),
  ]);

  return (
    <div className="mt-16 min-h-screen bg-black text-white">
      <div className="md:pb-8">
        <Header
          title="Admin — Carpool Analytics"
          subtitle="Overview of platform performance and security"
          // subtitle={session.user.name ?? ""}
        />
      </div>

      <main className="px-4 pt-6 pb-20 md:px-20">
        <AdminTabs
          summary={
            <section className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                  <div className="text-xs text-gray-300">Trips</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.tripsCount}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                  <div className="text-xs text-gray-300">
                    Seats Sold / Capacity
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.seatsSold}{" "}
                    <span className="text-gray-400">
                      / {summary.seatsCapacity}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                  <div className="text-xs text-gray-300">Occupancy</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-300">
                    {pct(summary.occupancy)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                  <div className="text-xs text-gray-300">Gross / Net</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {fmtMoney(summary.grossCents, summary.currency)}
                    <span className="text-sm text-gray-300">
                      {" "}
                      / {fmtMoney(summary.netCents, summary.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">
                    Daily Sales Trend
                  </h3>
                  <div className="text-xs text-gray-400">
                    Points: {trend.series.length} · Currency: {trend.currency}
                  </div>
                </div>
                <Sparkline
                  series={trend.series.map((d) => ({
                    label: d.bucket,
                    value: d.netCents,
                  }))}
                  height={80}
                />
                <div className="mt-4 overflow-x-auto rounded border border-gray-800">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-950 text-left text-gray-300">
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
                          className="border-t border-gray-800 hover:bg-gray-950"
                        >
                          <td className="px-3 py-2">{r.bucket}</td>
                          <td className="px-3 py-2">{r.trips}</td>
                          <td className="px-3 py-2">
                            {fmtMoney(r.grossCents, trend.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {fmtMoney(r.netCents, trend.currency)}
                          </td>
                        </tr>
                      ))}
                      {trend.series.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-gray-400"
                          >
                            No data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          }
          sales={
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-200">
                Trip Revenues (latest)
              </h3>
              <div className="overflow-x-auto rounded border border-gray-800">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-950 text-left text-gray-300">
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
                        className="border-t border-gray-800 hover:bg-gray-950"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {t.fromLabel} → {t.toLabel}
                          </div>
                          <div className="text-xs text-gray-400">
                            {t.tripId}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {new Date(t.departureAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {t.seatsTaken}/{t.seatsTotal}
                        </td>
                        <td className="px-3 py-2">{fmtMoney(t.grossCents)}</td>
                        <td className="px-3 py-2">{fmtMoney(t.netCents)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {trips.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center text-gray-400"
                        >
                          No trips yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          }
          security={
            <section className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <h3 className="text-sm font-semibold text-gray-200">
                  Security / Anomalies
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Heuristics: trips canceled, zero-seat trips, low occupancy,
                  high rejection rate.
                </p>
                <div className="mt-3 overflow-x-auto rounded border border-gray-800">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-950 text-left text-gray-300">
                        <th className="px-3 py-2">Trip</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {security.anomalies.map((a) => (
                        <tr
                          key={`${a.tripId}-${a.type}-${a.departureAt}`}
                          className="border-t border-gray-800 hover:bg-gray-950"
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium">{a.route}</div>
                            <div className="text-xs text-gray-400">
                              {a.tripId}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex rounded border border-amber-700 bg-amber-900/50 px-2 py-0.5 text-xs text-amber-200">
                              {a.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {new Date(a.departureAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{a.detail}</td>
                        </tr>
                      ))}
                      {security.anomalies.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-gray-400"
                          >
                            No anomalies detected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <h3 className="text-sm font-semibold text-gray-200">
                  Operations
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Examples: export last month CSV, re-run pricing job, etc.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-500">
                    Export CSV (last 30d)
                  </button>
                  <button className="rounded bg-teal-600 px-3 py-1.5 text-sm hover:bg-teal-500">
                    Recompute Pricing
                  </button>
                  <button className="rounded bg-rose-600 px-3 py-1.5 text-sm hover:bg-rose-500">
                    Flag Suspicious Trips
                  </button>
                </div>
              </div>
            </section>
          }
        />
      </main>

      <Footer />
    </div>
  );
}
