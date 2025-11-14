import { NextRequest } from "next/server";
import { buildFleetData, getShipmentsWithJoins } from "@/lib/fleet-data";
import {
  parseFilterStateFromSearchParams,
  serializeFilterState,
  toShipmentFilters,
} from "@/lib/filter-state";

export function GET(request: NextRequest) {
  const data = buildFleetData();
  const filterState = parseFilterStateFromSearchParams(request.nextUrl.searchParams);
  const shipments = getShipmentsWithJoins(data, toShipmentFilters(filterState));

  return Response.json({
    count: shipments.length,
    filters: filterState,
    query: serializeFilterState(filterState).toString(),
    shipments,
    generatedAt: new Date().toISOString(),
  });
}
