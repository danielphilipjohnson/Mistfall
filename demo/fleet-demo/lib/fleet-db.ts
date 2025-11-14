import { faker } from "@faker-js/faker";
import { connect, type DatabaseClient } from "../../../src";

import {
  carriers,
  drivers,
  fleetSchema,
  hubs,
  invoices,
  maintenance,
  routes,
  shipments,
  telemetry,
  vehicles,
  type Carrier,
  type Driver,
  type FleetDataset,
  type Hub,
  type Invoice,
  type MaintenanceEvent,
  type Route,
  type Shipment,
  type Telemetry,
  type Vehicle,
  enumLookups,
} from "@/lib/fleet-schema";

export type FleetDbClient = DatabaseClient<typeof fleetSchema>;

let dbPromise: Promise<FleetDbClient> | null = null;

export async function getFleetDb(): Promise<FleetDbClient> {
  if (!dbPromise) {
    dbPromise = createFleetDb();
  }
  return dbPromise;
}

async function createFleetDb(): Promise<FleetDbClient> {
  const db = await connect(fleetSchema, {
    adapter: "memory",
    dbName: "fleet-demo",
  });

  await ensureFleetSeeded(db);
  return db;
}

export async function loadFleetDataset(): Promise<FleetDataset> {
  const db = await getFleetDb();
  return readFleetDataset(db);
}

export async function readFleetDataset(db: FleetDbClient): Promise<FleetDataset> {
  const [carrierRows, hubRows, vehicleRows, driverRows, routeRows, shipmentRows, telemetryRows, invoiceRows, maintenanceRows] =
    await Promise.all([
      db.select(carriers),
      db.select(hubs),
      db.select(vehicles),
      db.select(drivers),
      db.select(routes),
      db.select(shipments),
      db.select(telemetry),
      db.select(invoices),
      db.select(maintenance),
    ]);

  return {
    carriers: carrierRows,
    hubs: hubRows,
    vehicles: vehicleRows,
    drivers: driverRows,
    routes: routeRows,
    shipments: shipmentRows,
    telemetry: telemetryRows,
    invoices: invoiceRows,
    maintenance: maintenanceRows,
  } satisfies FleetDataset;
}

export async function ensureFleetSeeded(db: FleetDbClient) {
  const existing = await db.select(carriers, { limit: 1 });
  if (existing.length) return;

  faker.seed(4096);
  const regions = ["West", "Mountain", "Midwest", "Southeast", "Northeast"] as const;

  const carriersToInsert: Carrier[] = Array.from({ length: 4 }, (_, idx) => ({
    id: `car-${idx + 1}`,
    name: `${faker.company.name()} Logistics`,
    region: regions[idx % regions.length],
    complianceScore: faker.number.float({ min: 88, max: 99, fractionDigits: 1 }),
    fleetSize: faker.number.int({ min: 120, max: 420 }),
  }));

  const carrierRows = await db.insert(carriers, carriersToInsert);

  const hubsToInsert: Hub[] = [];
  carrierRows.forEach((carrier) => {
    for (let idx = 0; idx < 3; idx += 1) {
      hubsToInsert.push({
        id: faker.string.uuid(),
        carrierId: carrier.id,
        name: `${faker.location.city()} Consolidation Hub`,
        region: carrier.region,
        capacityLoads: faker.number.int({ min: 120, max: 400 }),
      });
    }
  });
  const hubRows = await db.insert(hubs, hubsToInsert);

  const hubsByCarrier = groupBy(hubRows, (hub) => hub.carrierId);

  const vehiclesToInsert: Vehicle[] = [];
  carrierRows.forEach((carrier) => {
    const carrierHubs = hubsByCarrier.get(carrier.id)!;
    for (let idx = 0; idx < 7; idx += 1) {
      const hub = faker.helpers.arrayElement(carrierHubs);
      vehiclesToInsert.push({
        id: `veh-${carrier.id}-${idx + 1}`,
        carrierId: carrier.id,
        hubId: hub.id,
        vin: faker.vehicle.vin(),
        type: faker.helpers.arrayElement(enumLookups.vehicleTypes),
        capacityPct: faker.number.int({ min: 45, max: 100 }),
        milesSinceService: faker.number.int({ min: 0, max: 15000 }),
        status: faker.helpers.arrayElement(["Available", "Assigned", "Maintenance"] as const),
      });
    }
  });
  const vehicleRows = await db.insert(vehicles, vehiclesToInsert);
  const vehiclesByCarrier = groupBy(vehicleRows, (vehicle) => vehicle.carrierId);

  const driversToInsert: Driver[] = [];
  carrierRows.forEach((carrier) => {
    const carrierHubs = hubsByCarrier.get(carrier.id)!;
    for (let idx = 0; idx < 10; idx += 1) {
      const hub = faker.helpers.arrayElement(carrierHubs);
      driversToInsert.push({
        id: faker.string.uuid(),
        carrierId: carrier.id,
        hubId: hub.id,
        name: faker.person.fullName(),
        seniorityLevel: faker.helpers.arrayElement(enumLookups.driverSeniority),
        endorsements: faker.helpers.arrayElements(["TWIC", "HAZMAT", "Doubles", "Tanker"], {
          min: 1,
          max: 3,
        }),
        onLeave: faker.datatype.boolean({ probability: 0.1 }),
      });
    }
  });
  const driverRows = await db.insert(drivers, driversToInsert);
  const driversByCarrier = groupBy(driverRows, (driver) => driver.carrierId);

  const routesToInsert: Route[] = [];
  carrierRows.forEach((carrier) => {
    const carrierHubs = hubsByCarrier.get(carrier.id)!;
    for (let idx = 0; idx < 5; idx += 1) {
      const [origin, destination] = faker.helpers.shuffle([...carrierHubs]).slice(0, 2);
      routesToInsert.push({
        id: `route-${carrier.id}-${idx + 1}`,
        carrierId: carrier.id,
        code: `${carrier.region.substring(0, 2).toUpperCase()}-${idx + 101}`,
        originHubId: origin.id,
        destinationHubId: destination.id,
        distanceMiles: faker.number.int({ min: 240, max: 2100 }),
        serviceLevel: faker.helpers.arrayElement(enumLookups.serviceLevels),
      });
    }
  });
  const routeRows = await db.insert(routes, routesToInsert);
  const routesByCarrier = groupBy(routeRows, (route) => route.carrierId);

  const shipmentsToInsert: Shipment[] = [];
  for (let idx = 0; idx < 48; idx += 1) {
    const carrier = faker.helpers.arrayElement(carrierRows);
    const route = faker.helpers.arrayElement(routesByCarrier.get(carrier.id)!);
    const vehicle = faker.helpers.arrayElement(vehiclesByCarrier.get(carrier.id)!);
    const driver = faker.helpers.arrayElement(driversByCarrier.get(carrier.id)!);
    const status = faker.helpers.arrayElement(enumLookups.statusValues);
    const priority = faker.helpers.arrayElement(enumLookups.priorityValues);

    shipmentsToInsert.push({
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
    });
  }
  const shipmentRows = await db.insert(shipments, shipmentsToInsert);

  await db.insert(
    telemetry,
    vehicleRows.map((vehicle) => ({
      id: faker.string.uuid(),
      vehicleId: vehicle.id,
      fuelPercent: faker.number.int({ min: 18, max: 100 }),
      tirePressurePsi: faker.number.int({ min: 86, max: 120 }),
      coolantTempF: faker.number.int({ min: 180, max: 240 }),
      harshEvents: faker.number.int({ min: 0, max: 6 }),
    } satisfies Telemetry)),
  );

  await db.insert(
    invoices,
    shipmentRows.map((shipment) => ({
      id: faker.string.uuid(),
      carrierId: shipment.carrierId,
      shipmentId: shipment.id,
      amountUsd: faker.number.int({ min: 12000, max: 220000 }),
      status: faker.helpers.arrayElement(enumLookups.invoiceStatus),
      dueDays: faker.number.int({ min: -15, max: 45 }),
    } satisfies Invoice)),
  );

  await db.insert(
    maintenance,
    vehicleRows.map((vehicle) => ({
      id: faker.string.uuid(),
      vehicleId: vehicle.id,
      severity: faker.helpers.arrayElement(enumLookups.maintenanceSeverity),
      description: faker.helpers.arrayElement([
        "Brake inspection due",
        "Oil analysis pending",
        "Coolant flush scheduled",
        "Tire replacement required",
      ]),
      dueInMiles: faker.number.int({ min: -500, max: 5000 }),
    } satisfies MaintenanceEvent)),
  );
}

function groupBy<TItem, TValue extends string | number>(
  items: TItem[],
  getKey: (item: TItem) => TValue,
): Map<TValue, TItem[]> {
  const map = new Map<TValue, TItem[]>();
  items.forEach((item) => {
    const key = getKey(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  });
  return map;
}
