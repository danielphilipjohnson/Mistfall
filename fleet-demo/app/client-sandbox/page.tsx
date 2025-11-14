"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connect } from "indexedb-drizzle";

import { fleetSchema } from "@/lib/fleet-schema";
import { ensureFleetSeeded, readFleetDataset } from "@/lib/fleet-db";
import { getShipmentsWithJoins, summarizeFleet, type ShipmentDetail } from "@/lib/fleet-data";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type ClientState = {
  status: "idle" | "connecting" | "seeding" | "ready" | "error";
  summary?: ReturnType<typeof summarizeFleet>;
  shipments?: ShipmentDetail[];
  error?: string;
};

export default function ClientSandboxPage() {
  const [state, setState] = useState<ClientState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setState({ status: "connecting" });
        const db = await connect(fleetSchema, { adapter: "auto", dbName: "fleet-demo-app" });
        if (cancelled) return;

        setState({ status: "seeding" });
        await ensureFleetSeeded(db);
        if (cancelled) return;

        const dataset = await readFleetDataset(db);
        if (cancelled) return;

        const summary = summarizeFleet(dataset);
        const shipments = getShipmentsWithJoins(dataset).slice(0, 6);
        setState({ status: "ready", summary, shipments });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: "error", error: message });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to server-rendered dashboard
        </Link>
        <header className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-blue-600">Fleet intelligence sandbox</p>
          <h1 className="text-3xl font-semibold text-slate-900">Client IndexedDB explorer</h1>
          <p className="text-sm text-slate-500">
            The same deterministic fleet graph, but hydrated entirely inside the browser using your
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">indexedb-drizzle</code>
            runtime. Use DevTools → Application → IndexedDB to inspect the tables as this page connects,
            seeds, and runs joins locally.
          </p>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Connection"
            highlight
            value={
              state.status === "ready"
                ? "IndexedDB synced"
                : state.status === "error"
                  ? "Failed"
                  : state.status === "seeding"
                    ? "Seeding data..."
                    : "Connecting..."
            }
            detail="Client-side adapter"
          />
          <SummaryCard
            label="Active shipments"
            value={state.summary ? numberFormatter.format(state.summary.activeShipments) : "—"}
            detail="Browser dataset"
          />
          <SummaryCard
            label="Cargo exposure"
            value={state.summary ? currencyFormatter.format(state.summary.totalValue) : "—"}
            detail="USD tracked"
          />
        </div>

        {state.status === "error" && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {state.error}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <SectionCard title="Sample joined shipments">
            {state.status !== "ready" && (
              <p className="text-sm text-slate-500">Loading rows from the client database...</p>
            )}
            {state.status === "ready" && state.shipments && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-3">Reference</th>
                      <th className="pb-3">Carrier / Route</th>
                      <th className="pb-3">Driver</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="py-3 font-semibold text-slate-900">{shipment.reference}</td>
                        <td className="py-3 text-sm text-slate-600">
                          {shipment.carrier.name}
                          <br />
                          <span className="text-xs text-slate-400">{shipment.route.code}</span>
                        </td>
                        <td className="py-3 text-sm text-slate-600">{shipment.driver.name}</td>
                        <td className="py-3">
                          <StatusBadge status={shipment.status} />
                        </td>
                        <td className="py-3 font-semibold text-slate-900">{shipment.riskScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-500">
                  Showing {state.shipments.length} of {state.summary?.activeShipments ?? "?"} rows seeded in the browser storage.
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Inspector tips">
            <ul className="space-y-3 text-sm text-slate-600">
              <li>
                Use DevTools → Application → IndexedDB → <code>fleet-demo-app</code> to browse the tables and
                watch writes in real time.
              </li>
              <li>
                Reload this page to rerun the deterministic seed or clear storage via the Application tab to
                start fresh.
              </li>
              <li>
                Extend this sandbox with client mutations to benchmark your runtime before wiring up a
                backend.
              </li>
            </ul>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  highlight,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  const gradient = highlight ? "bg-gradient-to-br from-blue-50 to-white" : "bg-white";
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${gradient}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    Scheduled: "bg-slate-100 text-slate-700",
    "In Transit": "bg-blue-100 text-blue-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Delayed: "bg-rose-100 text-rose-700",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? "bg-slate-100"}`}>
      {status}
    </span>
  );
}
