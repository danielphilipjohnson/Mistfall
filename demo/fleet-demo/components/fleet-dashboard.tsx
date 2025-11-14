"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CarrierSummary,
  DriverLeaderboardEntry,
  FleetAlert,
  Shipment,
  ShipmentDetail,
} from "@/lib/fleet-data";
import type { FilterState } from "@/lib/filter-state";
import { serializeFilterState } from "@/lib/filter-state";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type FilterOptions = {
  regions: string[];
  statuses: Shipment["status"][];
  priorities: Shipment["priority"][];
};

const statusColorMap: Record<Shipment["status"], string> = {
  Scheduled: "bg-slate-100 text-slate-700",
  "In Transit": "bg-blue-100 text-blue-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Delayed: "bg-rose-100 text-rose-700",
};

const priorityBorderMap: Record<Shipment["priority"], string> = {
  Critical: "border-rose-400 text-rose-600",
  High: "border-amber-400 text-amber-600",
  Standard: "border-slate-300 text-slate-600",
};

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-slate-200 text-slate-600 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function SectionCard({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 80 ? "High" : score >= 60 ? "Elevated" : "Stable";
  const color =
    level === "High"
      ? "bg-rose-50 text-rose-600"
      : level === "Elevated"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {level}
    </span>
  );
}

export function FleetDashboard({
  shipments,
  carrierSummaries,
  driverLeaderboard,
  alerts,
  summary,
  filterOptions,
  selectedFilters,
}: {
  shipments: ShipmentDetail[];
  carrierSummaries: CarrierSummary[];
  driverLeaderboard: DriverLeaderboardEntry[];
  alerts: FleetAlert[];
  summary: {
    activeShipments: number;
    delayedShipments: number;
    totalValue: number;
    avgRisk: number;
    criticalAlerts: number;
  };
  filterOptions: FilterOptions;
  selectedFilters: FilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(selectedFilters);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFilters(selectedFilters);
  }, [selectedFilters]);

  const pushFilters = (updater: (current: FilterState) => FilterState) => {
    setFilters((current) => {
      const nextFilters = updater(current);
      const params = serializeFilterState(nextFilters, searchParams);
      startTransition(() => {
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
      return nextFilters;
    });
  };

  const toggleStatus = (status: Shipment["status"]) =>
    pushFilters((current) => ({
      ...current,
      statuses: toggleValue(current.statuses, status),
    }));

  const toggleRegion = (region: string) =>
    pushFilters((current) => ({
      ...current,
      regions: toggleValue(current.regions, region),
    }));

  const togglePriority = (priority: Shipment["priority"]) =>
    pushFilters((current) => ({
      ...current,
      priorities: toggleValue(current.priorities, priority),
    }));

  const toggleHighRisk = (checked: boolean) =>
    pushFilters((current) => ({ ...current, highRiskOnly: checked }));

  const shipmentsToRender = shipments.slice(0, 15);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-blue-600">Fleet intelligence sandbox</p>
        <h1 className="text-3xl font-semibold text-slate-900">Logistics graph explorer</h1>
        <p className="text-sm text-slate-500">
          Deterministic mock data stitched together with joins so you can stress-test data
          fetching, filtering, server actions, and visualizations without wiring up a real
          database yet.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active shipments</p>
          <p className="text-3xl font-semibold text-slate-900">
            {numberFormatter.format(summary.activeShipments)}
          </p>
          <p className="text-xs text-slate-500">
            {summary.delayedShipments} delayed • {summary.criticalAlerts} critical alerts
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Exposure</p>
          <p className="text-3xl font-semibold text-slate-900">
            {currencyFormatter.format(summary.totalValue)}
          </p>
          <p className="text-xs text-slate-500">Total cargo value tracked in this slice</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Average risk</p>
          <p className="text-3xl font-semibold text-slate-900">{summary.avgRisk.toFixed(1)}</p>
          <p className="text-xs text-slate-500">Blend of telematics, status and compliance signals</p>
        </div>
      </div>

      <SectionCard
        title="Cross-filter shipments"
        extra={
          <span className="text-xs font-medium text-slate-400">
            {isPending ? "Refreshing dataset…" : `Showing ${shipments.length} joined rows`}
          </span>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterOptions.statuses.map((status) => (
                <FilterChip
                  key={status}
                  label={status}
                  active={filters.statuses.includes(status)}
                  onClick={() => toggleStatus(status)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Region</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterOptions.regions.map((region) => (
                <FilterChip
                  key={region}
                  label={region}
                  active={filters.regions.includes(region)}
                  onClick={() => toggleRegion(region)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterOptions.priorities.map((priority) => (
                <FilterChip
                  key={priority}
                  label={priority}
                  active={filters.priorities.includes(priority)}
                  onClick={() => togglePriority(priority)}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filters.highRiskOnly}
              onChange={(event) => toggleHighRisk(event.target.checked)}
              className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
            />
            Show only risk scores ≥ 70
          </label>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard title={`Shipments (${shipments.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Carrier / Route</th>
                  <th className="pb-3">Driver / Equipment</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">ETA</th>
                  <th className="pb-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipmentsToRender.map((shipment) => (
                  <tr key={shipment.id} className="align-top">
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">{shipment.reference}</p>
                      <p className="text-xs text-slate-500">{shipment.origin.name}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-medium text-slate-900">{shipment.carrier.name}</p>
                      <p className="text-xs text-slate-500">
                        {shipment.route.code} • {shipment.origin.region} → {shipment.destination.region}
                      </p>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-medium text-slate-900">{shipment.driver.name}</p>
                      <p className="text-xs text-slate-500">
                        {shipment.vehicle.type} • VIN {shipment.vehicle.vin.slice(0, 8)}
                      </p>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColorMap[shipment.status]}`}
                      >
                        {shipment.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBorderMap[shipment.priority]}`}
                      >
                        {shipment.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-medium text-slate-900">{shipment.etaHours}h</p>
                      <p className="text-xs text-slate-500">{shipment.temperatureControlled ? "Temp" : "Dry"}</p>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{shipment.riskScore}</p>
                        <RiskBadge score={shipment.riskScore} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shipments.length > shipmentsToRender.length && (
            <p className="mt-4 text-xs text-slate-500">
              Showing {shipmentsToRender.length} of {shipments.length} joined records.
              Wire up pagination or server actions when you swap in a real database.
            </p>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Carrier rollups">
            <div className="space-y-4">
              {carrierSummaries.map((summary) => (
                <div key={summary.carrier.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-slate-900">{summary.carrier.name}</p>
                    <p className="text-xs text-slate-500">{summary.carrier.region}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <p>{summary.activeShipments} active • {summary.delayedShipments} delayed</p>
                    <p>{summary.onTimeRate.toFixed(1)}% on-time</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(summary.capacityUtilization, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <p>Avg risk {summary.avgRisk.toFixed(1)}</p>
                    <p>{currencyFormatter.format(summary.outstandingAr)} AR</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Driver leaderboard">
            <div className="space-y-3">
              {driverLeaderboard.map((entry) => (
                <div key={entry.driver.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.driver.name}</p>
                      <p className="text-xs text-slate-500">
                        {entry.completedTrips} trips • {entry.onTimeRate.toFixed(0)}% on-time
                      </p>
                    </div>
                    <RiskBadge score={entry.avgRisk} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Endorsements: {entry.endorsements}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Live alerts">
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                    <span
                      className={`text-xs font-medium ${
                        alert.severity === "critical"
                          ? "text-rose-600"
                          : alert.severity === "warn"
                            ? "text-amber-600"
                            : "text-slate-500"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{alert.detail}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{alert.type}</p>
                </div>
              ))}
            </div>
            {alerts.length > 5 && (
              <p className="mt-3 text-xs text-slate-500">
                {alerts.length - 5}+ additional alerts collapsed for brevity.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
