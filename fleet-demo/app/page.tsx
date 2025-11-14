import Link from "next/link";

import { FleetDashboard } from "@/components/fleet-dashboard";
import {
  buildFleetData,
  getCarrierSummaries,
  getDriverLeaderboard,
  getFleetAlerts,
  getFilterOptions,
  getShipmentsWithJoins,
  summarizeFleet,
} from "@/lib/fleet-data";
import { parseFilterStateFromObject, toShipmentFilters } from "@/lib/filter-state";

type SearchParamInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParamInput | Promise<SearchParamInput>;
};

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await buildFleetData();
  console.log(data)
  const selectedFilters = parseFilterStateFromObject(resolvedSearchParams);
  const shipments = getShipmentsWithJoins(data, toShipmentFilters(selectedFilters));
  const summary = summarizeFleet(data);
  const carrierSummaries = getCarrierSummaries(data);
  const driverLeaderboard = getDriverLeaderboard(data);
  const alerts = getFleetAlerts(data);
  const filterOptions = getFilterOptions(data);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="mb-4 text-xs text-slate-500">
          Need to inspect the browser IndexedDB?{" "}
          <Link href="/client-sandbox" className="font-semibold text-blue-600">
            Open the client sandbox
          </Link>
          .
        </p>
        <FleetDashboard
          shipments={shipments}
          carrierSummaries={carrierSummaries}
          driverLeaderboard={driverLeaderboard}
          alerts={alerts}
          summary={summary}
          filterOptions={filterOptions}
          selectedFilters={selectedFilters}
        />
      </main>
    </div>
  );
}
