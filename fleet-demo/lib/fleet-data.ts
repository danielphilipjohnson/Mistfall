import { faker } from "@faker-js/faker";

export type Carrier = {
  id: string;
  name: string;
  region: string;
  complianceScore: number;
  fleetSize: number;
};

export type Hub = {
  id: string;
  carrierId: string;
  name: string;
  region: string;
  capacityLoads: number;
};

export type Vehicle = {
  id: string;
  carrierId: string;
  hubId: string;
  vin: string;
  type: "Reefer" | "Dry Van" | "Flatbed";
  capacityPct: number;
  milesSinceService: number;
  status: "Available" | "Assigned" | "Maintenance";
};

export type Driver = {
  id: string;
  carrierId: string;
  hubId: string;
  name: string;
  seniorityLevel: "Junior" | "Mid" | "Senior";
  endorsements: string[];
  onLeave: boolean;
};

export type Route = {
  id: string;
  carrierId: string;
  code: string;
  originHubId: string;
  destinationHubId: string;
  distanceMiles: number;
  serviceLevel: "Next Day" | "Two Day" | "Economy";
};

export type Shipment = {
  id: string;
  carrierId: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  reference: string;
  status: "Scheduled" | "In Transit" | "Delivered" | "Delayed";
  priority: "Critical" | "High" | "Standard";
  valueUsd: number;
  etaHours: number;
  riskScore: number;
  temperatureControlled: boolean;
};

export type Telemetry = {
  id: string;
  vehicleId: string;
  fuelPercent: number;
  tirePressurePsi: number;
  coolantTempF: number;
  harshEvents: number;
};

export type Invoice = {
  id: string;
  carrierId: string;
  shipmentId: string;
  amountUsd: number;
  status: "Pending" | "Paid" | "Overdue";
  dueDays: number;
};

export type MaintenanceEvent = {
  id: string;
  vehicleId: string;
  severity: "Low" | "Medium" | "High";
  description: string;
  dueInMiles: number;
};

export type FleetDataset = {
  carriers: Carrier[];
  hubs: Hub[];
  vehicles: Vehicle[];
  drivers: Driver[];
  routes: Route[];
  shipments: Shipment[];
  telemetry: Telemetry[];
  invoices: Invoice[];
  maintenance: MaintenanceEvent[];
};

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

const equipmentTypes: Vehicle["type"][] = ["Reefer", "Dry Van", "Flatbed"];
const serviceLevels: Route["serviceLevel"][] = ["Next Day", "Two Day", "Economy"];
const driverEndorsements = ["TWIC", "HAZMAT", "Doubles", "Tanker"];

let datasetCache: FleetDataset | null = null;

export function buildFleetData(): FleetDataset {
  if (datasetCache) {
    return datasetCache;
  }

  faker.seed(4096);

  const regions = ["West", "Mountain", "Midwest", "Southeast"] as const;

  const carriers: Carrier[] = Array.from({ length: 4 }, (_, idx) => ({
    id: `car-${idx + 1}`,
    name: `${faker.company.name()} Logistics`,
    region: regions[idx % regions.length],
    complianceScore: faker.number.float({ min: 88, max: 99, fractionDigits: 1 }),
    fleetSize: faker.number.int({ min: 120, max: 420 }),
  }));

  const hubs: Hub[] = carriers.flatMap((carrier) =>
    Array.from({ length: 3 }, () => ({
      id: faker.string.uuid(),
      carrierId: carrier.id,
      name: `${faker.location.city()} Consolidation Hub`,
      region: carrier.region,
      capacityLoads: faker.number.int({ min: 120, max: 400 }),
    })),
  );

  const vehicles: Vehicle[] = carriers.flatMap((carrier) =>
    Array.from({ length: 8 }, (_, idx) => {
      const hub = faker.helpers.arrayElement(
        hubs.filter((h) => h.carrierId === carrier.id),
      );
      return {
        id: `veh-${carrier.id}-${idx + 1}`,
        carrierId: carrier.id,
        hubId: hub.id,
        vin: faker.vehicle.vin(),
        type: faker.helpers.arrayElement(equipmentTypes),
        capacityPct: faker.number.int({ min: 45, max: 100 }),
        milesSinceService: faker.number.int({ min: 0, max: 15000 }),
        status: faker.helpers.arrayElement(["Available", "Assigned", "Maintenance"]),
      } satisfies Vehicle;
    }),
  );

  const drivers: Driver[] = carriers.flatMap((carrier) =>
    Array.from({ length: 12 }, () => {
      const hub = faker.helpers.arrayElement(
        hubs.filter((h) => h.carrierId === carrier.id),
      );
      return {
        id: faker.string.uuid(),
        carrierId: carrier.id,
        hubId: hub.id,
        name: faker.person.fullName(),
        seniorityLevel: faker.helpers.arrayElement(["Junior", "Mid", "Senior"]),
        endorsements: faker.helpers.arrayElements(driverEndorsements, {
          min: 1,
          max: 3,
        }),
        onLeave: faker.datatype.boolean({ probability: 0.1 }),
      } satisfies Driver;
    }),
  );

  const routes: Route[] = carriers.flatMap((carrier) => {
    const carrierHubs = hubs.filter((h) => h.carrierId === carrier.id);
    return Array.from({ length: 5 }, (_, idx) => {
      const [origin, destination] = faker.helpers.shuffle(carrierHubs).slice(0, 2);
      return {
        id: `route-${carrier.id}-${idx + 1}`,
        carrierId: carrier.id,
        code: `${carrier.region.substring(0, 2).toUpperCase()}-${idx + 101}`,
        originHubId: origin.id,
        destinationHubId: destination.id,
        distanceMiles: faker.number.int({ min: 240, max: 2100 }),
        serviceLevel: faker.helpers.arrayElement(serviceLevels),
      } satisfies Route;
    });
  });

  const shipments: Shipment[] = Array.from({ length: 48 }, () => {
    const carrier = faker.helpers.arrayElement(carriers);
    const route = faker.helpers.arrayElement(routes.filter((r) => r.carrierId === carrier.id));
    const vehicle = faker.helpers.arrayElement(vehicles.filter((v) => v.carrierId === carrier.id));
    const driver = faker.helpers.arrayElement(drivers.filter((d) => d.carrierId === carrier.id));
    const status = faker.helpers.arrayElement(["Scheduled", "In Transit", "Delivered", "Delayed"]);
    const priority = faker.helpers.arrayElement(["Critical", "High", "Standard"]);

    return {
      id: faker.string.uuid(),
      carrierId: carrier.id,
      routeId: route.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      reference: faker.string.alphanumeric({ length: 8, casing: "upper" }),
      status,
      priority,
      valueUsd: faker.number.int({ min: 15000, max: 180000 }),
      etaHours: faker.number.int({ min: 2, max: 72 }),
      riskScore:
        status === "Delayed"
          ? faker.number.int({ min: 70, max: 99 })
          : faker.number.int({ min: 10, max: 65 }),
      temperatureControlled: faker.datatype.boolean({ probability: 0.35 }),
    } satisfies Shipment;
  });

  const telemetry: Telemetry[] = vehicles.map((vehicle) => ({
    id: faker.string.uuid(),
    vehicleId: vehicle.id,
    fuelPercent: faker.number.int({ min: 18, max: 100 }),
    tirePressurePsi: faker.number.int({ min: 86, max: 120 }),
    coolantTempF: faker.number.int({ min: 180, max: 240 }),
    harshEvents: faker.number.int({ min: 0, max: 6 }),
  }));

  const invoices: Invoice[] = shipments.map((shipment) => ({
    id: faker.string.uuid(),
    carrierId: shipment.carrierId,
    shipmentId: shipment.id,
    amountUsd: faker.number.int({ min: 12000, max: 220000 }),
    status: faker.helpers.arrayElement(["Pending", "Paid", "Overdue"]),
    dueDays: faker.number.int({ min: -15, max: 45 }),
  }));

  const maintenance: MaintenanceEvent[] = vehicles.map((vehicle) => ({
    id: faker.string.uuid(),
    vehicleId: vehicle.id,
    severity: faker.helpers.arrayElement(["Low", "Medium", "High"]),
    description: faker.helpers.arrayElement([
      "Brake inspection due",
      "Oil analysis pending",
      "Coolant flush scheduled",
      "Tire replacement required",
    ]),
    dueInMiles: faker.number.int({ min: -500, max: 5000 }),
  }));

  datasetCache = {
    carriers,
    hubs,
    vehicles,
    drivers,
    routes,
    shipments,
    telemetry,
    invoices,
    maintenance,
  } satisfies FleetDataset;

  return datasetCache;
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
    const capacityUtilization = (vehiclesByCarrier[carrier.id] ?? []).length
      ? (vehiclesByCarrier[carrier.id] ?? []).reduce((sum, vehicle) => sum + vehicle.capacityPct, 0) /
        (vehiclesByCarrier[carrier.id] ?? []).length
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
        endorsements: driver.endorsements.join(", "),
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
