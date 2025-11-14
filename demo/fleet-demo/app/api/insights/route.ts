import {
  buildFleetData,
  getCarrierSummaries,
  getDriverLeaderboard,
  getFleetAlerts,
  summarizeFleet,
} from "@/lib/fleet-data";

export async function GET() {
  const data = await buildFleetData();

  return Response.json({
    summary: summarizeFleet(data),
    carriers: getCarrierSummaries(data),
    drivers: getDriverLeaderboard(data),
    alerts: getFleetAlerts(data),
    generatedAt: new Date().toISOString(),
  });
}
