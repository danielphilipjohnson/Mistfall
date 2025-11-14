import {
  buildFleetData,
  getCarrierSummaries,
  getDriverLeaderboard,
  getFleetAlerts,
  summarizeFleet,
} from "@/lib/fleet-data";

export function GET() {
  const data = buildFleetData();

  return Response.json({
    summary: summarizeFleet(data),
    carriers: getCarrierSummaries(data),
    drivers: getDriverLeaderboard(data),
    alerts: getFleetAlerts(data),
    generatedAt: new Date().toISOString(),
  });
}
