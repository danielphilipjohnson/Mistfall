import { schema, table, t, type InferSelect } from "mistfall";

const vehicleTypes = ["Reefer", "Dry Van", "Flatbed"] as const;
const statusValues = ["Scheduled", "In Transit", "Delivered", "Delayed"] as const;
const priorityValues = ["Critical", "High", "Standard"] as const;
const serviceLevels = ["Next Day", "Two Day", "Economy"] as const;
const driverSeniority = ["Junior", "Mid", "Senior"] as const;
const maintenanceSeverity = ["Low", "Medium", "High"] as const;
const invoiceStatus = ["Pending", "Paid", "Overdue"] as const;

export const carriers = table("carriers", {
  id: t.text().primaryKey(),
  name: t.text().notNull(),
  region: t.text().notNull(),
  complianceScore: t.float().notNull(),
  fleetSize: t.int().notNull(),
});

export const hubs = table("hubs", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  name: t.text().notNull(),
  region: t.text().notNull(),
  capacityLoads: t.int().notNull(),
});

export const vehicles = table("vehicles", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  hubId: t.text().references(() => hubs.id).notNull(),
  vin: t.text().notNull(),
  type: t.enum(vehicleTypes).notNull(),
  capacityPct: t.int().notNull(),
  milesSinceService: t.int().notNull(),
  status: t.enum(["Available", "Assigned", "Maintenance"] as const).notNull(),
});

export const drivers = table("drivers", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  hubId: t.text().references(() => hubs.id).notNull(),
  name: t.text().notNull(),
  seniorityLevel: t.enum(driverSeniority).notNull(),
  endorsements: t.json<string[]>().notNull(),
  onLeave: t.boolean().default(false),
});

export const routes = table("routes", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  code: t.text().notNull(),
  originHubId: t.text().references(() => hubs.id).notNull(),
  destinationHubId: t.text().references(() => hubs.id).notNull(),
  distanceMiles: t.int().notNull(),
  serviceLevel: t.enum(serviceLevels).notNull(),
});

export const shipments = table("shipments", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  routeId: t.text().references(() => routes.id).notNull(),
  vehicleId: t.text().references(() => vehicles.id).notNull(),
  driverId: t.text().references(() => drivers.id).notNull(),
  reference: t.text().notNull(),
  status: t.enum(statusValues).notNull(),
  priority: t.enum(priorityValues).notNull(),
  valueUsd: t.int().notNull(),
  etaHours: t.int().notNull(),
  riskScore: t.int().notNull(),
  temperatureControlled: t.boolean().notNull(),
});

export const telemetry = table("telemetry", {
  id: t.text().primaryKey(),
  vehicleId: t.text().references(() => vehicles.id).notNull(),
  fuelPercent: t.int().notNull(),
  tirePressurePsi: t.int().notNull(),
  coolantTempF: t.int().notNull(),
  harshEvents: t.int().notNull(),
});

export const invoices = table("invoices", {
  id: t.text().primaryKey(),
  carrierId: t.text().references(() => carriers.id).notNull(),
  shipmentId: t.text().references(() => shipments.id).notNull(),
  amountUsd: t.int().notNull(),
  status: t.enum(invoiceStatus).notNull(),
  dueDays: t.int().notNull(),
});

export const maintenance = table("maintenance", {
  id: t.text().primaryKey(),
  vehicleId: t.text().references(() => vehicles.id).notNull(),
  severity: t.enum(maintenanceSeverity).notNull(),
  description: t.text().notNull(),
  dueInMiles: t.int().notNull(),
});

export const fleetSchema = schema({ name: "fleet-demo", version: 1 }, {
  carriers,
  hubs,
  vehicles,
  drivers,
  routes,
  shipments,
  telemetry,
  invoices,
  maintenance,
});

export type Carrier = InferSelect<typeof carriers>;
export type Hub = InferSelect<typeof hubs>;
export type Vehicle = InferSelect<typeof vehicles>;
export type Driver = InferSelect<typeof drivers>;
export type Route = InferSelect<typeof routes>;
export type Shipment = InferSelect<typeof shipments>;
export type Telemetry = InferSelect<typeof telemetry>;
export type Invoice = InferSelect<typeof invoices>;
export type MaintenanceEvent = InferSelect<typeof maintenance>;

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

export const enumLookups = {
  vehicleTypes,
  statusValues,
  priorityValues,
  serviceLevels,
  driverSeniority,
  maintenanceSeverity,
  invoiceStatus,
} as const;
