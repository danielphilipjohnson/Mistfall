import type {
  Carrier,
  FleetDataset,
  Hub,
  Invoice,
  Route,
  Shipment,
  Vehicle,
  Driver,
} from "@/lib/fleet-schema";
import { loadFleetDataset } from "@/lib/fleet-db";

export type ShipmentFilters = {
  statuses?: Shipment["status"][];
  regions?: string[];
  priorities?: Shipment["priority"][];
  highRiskOnly?: boolean;
};

export type ShipmentDetail = Shipment & {
  carrier: Carrier;
  vehicle: Vehicle;
  driver: Driver;
  route: Route;
  origin: Hub;
  destination: Hub;
};

export type CarrierSummary = {
  carrier: Carrier;
  activeShipments: number;
  delayedShipments: number;
  onTimeRate: number;
  avgRisk: number;
  capacityUtilization: number;
  outstandingAr: number;
};

export type DriverLeaderboardEntry = {
  driver: Driver;
  completedTrips: number;
  onTimeRate: number;
  avgRisk: number;
  endorsements: string;
};

export type FleetAlert = {
  id: string;
  type: "Maintenance" | "Telemetry" | "Shipment";
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
};

export async function buildFleetData(): Promise<FleetDataset> {
  return loadFleetDataset();
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item] as const));
}

export function getShipmentsWithJoins(
  data: FleetDataset,
  filters: ShipmentFilters = {},
): ShipmentDetail[] {
  const driverMap = mapById(data.drivers);
  const vehicleMap = mapById(data.vehicles);
  const routeMap = mapById(data.routes);
  const hubMap = mapById(data.hubs);
  const carrierMap = mapById(data.carriers);

  const statusFilter = filters.statuses ? new Set(filters.statuses) : null;
  const regionFilter = filters.regions ? new Set(filters.regions) : null;
  const priorityFilter = filters.priorities ? new Set(filters.priorities) : null;

  return data.shipments
    .map((shipment) => {
      const route = routeMap.get(shipment.routeId)!;
      const origin = hubMap.get(route.originHubId)!;
      const destination = hubMap.get(route.destinationHubId)!;
      const detail: ShipmentDetail = {
        ...shipment,
        carrier: carrierMap.get(shipment.carrierId)!,
        vehicle: vehicleMap.get(shipment.vehicleId)!,
        driver: driverMap.get(shipment.driverId)!,
        route,
        origin,
        destination,
      };
      return detail;
    })
    .filter((detail) => {
      const matchesStatus = statusFilter ? statusFilter.has(detail.status) : true;
      const matchesRegion = regionFilter ? regionFilter.has(detail.origin.region) : true;
      const matchesPriority = priorityFilter ? priorityFilter.has(detail.priority) : true;
      const matchesRisk = filters.highRiskOnly ? detail.riskScore >= 70 : true;
      return matchesStatus && matchesRegion && matchesPriority && matchesRisk;
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getCarrierSummaries(data: FleetDataset): CarrierSummary[] {
  const shipmentsByCarrier = data.shipments.reduce<Record<string, Shipment[]>>((acc, shipment) => {
    acc[shipment.carrierId] ??= [];
    acc[shipment.carrierId].push(shipment);
    return acc;
  }, {});

  const invoicesByCarrier = data.invoices.reduce<Record<string, Invoice[]>>((acc, invoice) => {
    acc[invoice.carrierId] ??= [];
    acc[invoice.carrierId].push(invoice);
    return acc;
  }, {});

  const vehiclesByCarrier = data.vehicles.reduce<Record<string, Vehicle[]>>((acc, vehicle) => {
    acc[vehicle.carrierId] ??= [];
    acc[vehicle.carrierId].push(vehicle);
    return acc;
  }, {});

  return data.carriers.map((carrier) => {
    const carrierShipments = shipmentsByCarrier[carrier.id] ?? [];
    const delivered = carrierShipments.filter((s) => s.status === "Delivered").length;
    const delayed = carrierShipments.filter((s) => s.status === "Delayed").length;
    const onTimeRate = carrierShipments.length
      ? (delivered / carrierShipments.length) * 100
      : 0;
    const avgRisk = carrierShipments.length
      ? carrierShipments.reduce((sum, s) => sum + s.riskScore, 0) / carrierShipments.length
      : 0;
    const outstandingAr = (invoicesByCarrier[carrier.id] ?? [])
      .filter((invoice) => invoice.status !== "Paid")
      .reduce((sum, invoice) => sum + invoice.amountUsd, 0);
    const capacityValues = vehiclesByCarrier[carrier.id] ?? [];
    const capacityUtilization = capacityValues.length
      ? capacityValues.reduce((sum, vehicle) => sum + vehicle.capacityPct, 0) / capacityValues.length
      : 0;

    return {
      carrier,
      activeShipments: carrierShipments.filter((s) => s.status !== "Delivered").length,
      delayedShipments: delayed,
      onTimeRate,
      avgRisk,
      capacityUtilization,
      outstandingAr,
    } satisfies CarrierSummary;
  });
}

export function getDriverLeaderboard(data: FleetDataset): DriverLeaderboardEntry[] {
  const shipmentsByDriver = data.shipments.reduce<Record<string, Shipment[]>>((acc, shipment) => {
    acc[shipment.driverId] ??= [];
    acc[shipment.driverId].push(shipment);
    return acc;
  }, {});

  return data.drivers
    .map((driver) => {
      const trips = shipmentsByDriver[driver.id] ?? [];
      const delivered = trips.filter((t) => t.status === "Delivered").length;
      const completedTrips = trips.length;
      const onTimeRate = completedTrips ? (delivered / completedTrips) * 100 : 0;
      const avgRisk = completedTrips
        ? trips.reduce((sum, t) => sum + t.riskScore, 0) / completedTrips
        : 0;
      return {
        driver,
        completedTrips,
        onTimeRate,
        avgRisk,
        endorsements: Array.isArray(driver.endorsements)
          ? driver.endorsements.join(", ")
          : "None",
      } satisfies DriverLeaderboardEntry;
    })
    .sort((a, b) => b.completedTrips - a.completedTrips)
    .slice(0, 5);
}

export function getFleetAlerts(data: FleetDataset): FleetAlert[] {
  const vehicleMap = mapById(data.vehicles);
  const alerts: FleetAlert[] = [];

  data.maintenance.forEach((event) => {
    if (event.dueInMiles <= 0 || event.severity === "High") {
      const vehicle = vehicleMap.get(event.vehicleId)!;
      alerts.push({
        id: event.id,
        type: "Maintenance",
        title: `${vehicle.type} ${vehicle.vin.substring(0, 6)} maintenance`,
        detail: `${event.description} (${event.dueInMiles} mi)`,
        severity: event.severity === "High" ? "critical" : "warn",
      });
    }
  });

  data.telemetry.forEach((entry) => {
    if (entry.fuelPercent < 25 || entry.coolantTempF > 220 || entry.harshEvents >= 4) {
      alerts.push({
        id: entry.id,
        type: "Telemetry",
        title: `Vehicle ${entry.vehicleId} telematics`,
        detail: `Fuel ${entry.fuelPercent}% • Coolant ${entry.coolantTempF}°F • Harsh ${entry.harshEvents}`,
        severity: entry.coolantTempF > 230 ? "critical" : "warn",
      });
    }
  });

  data.shipments.forEach((shipment) => {
    if (shipment.status === "Delayed" || shipment.riskScore >= 80) {
      alerts.push({
        id: shipment.id,
        type: "Shipment",
        title: `${shipment.reference} risk`,
        detail: `${shipment.status} • Priority ${shipment.priority} • Risk ${shipment.riskScore}`,
        severity: shipment.riskScore >= 90 ? "critical" : "warn",
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityWeight = { critical: 2, warn: 1, info: 0 } as const;
    return severityWeight[b.severity] - severityWeight[a.severity];
  });
}

export function summarizeFleet(data: FleetDataset) {
  const activeShipments = data.shipments.filter((s) => s.status !== "Delivered").length;
  const delayedShipments = data.shipments.filter((s) => s.status === "Delayed").length;
  const totalValue = data.shipments.reduce((sum, s) => sum + s.valueUsd, 0);
  const avgRisk = data.shipments.reduce((sum, s) => sum + s.riskScore, 0) / data.shipments.length;
  const criticalAlerts = getFleetAlerts(data).filter((alert) => alert.severity === "critical").length;

  return {
    activeShipments,
    delayedShipments,
    totalValue,
    avgRisk,
    criticalAlerts,
  } as const;
}

export function getFilterOptions(data: FleetDataset) {
  const regions = Array.from(new Set(data.hubs.map((hub) => hub.region)));
  const statuses = Array.from(new Set(data.shipments.map((shipment) => shipment.status)));
  const priorities = Array.from(new Set(data.shipments.map((shipment) => shipment.priority)));

  return {
    regions,
    statuses,
    priorities,
  } as const;
}
