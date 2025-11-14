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

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Home({ searchParams = {} }: PageProps) {
  const data = buildFleetData();
  const selectedFilters = parseFilterStateFromObject(searchParams);
  const shipments = getShipmentsWithJoins(data, toShipmentFilters(selectedFilters));
  const summary = summarizeFleet(data);
  const carrierSummaries = getCarrierSummaries(data);
  const driverLeaderboard = getDriverLeaderboard(data);
  const alerts = getFleetAlerts(data);
  const filterOptions = getFilterOptions(data);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
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
