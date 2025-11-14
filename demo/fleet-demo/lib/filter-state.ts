import type { Shipment, ShipmentFilters } from "@/lib/fleet-data";

type ParamValue = string | string[] | undefined;

export type FilterState = {
  statuses: Shipment["status"][];
  regions: string[];
  priorities: Shipment["priority"][];
  highRiskOnly: boolean;
};

const FILTER_KEYS = ["statuses", "regions", "priorities", "highRiskOnly"] as const;

function splitParam(value?: ParamValue) {
  if (!value) return [] as string[];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseBoolean(value?: ParamValue) {
  if (!value) return false;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw?.toLowerCase() === "true";
}

function unique<T extends string>(items: T[]) {
  return Array.from(new Set(items)) as T[];
}

export function parseFilterStateFromObject(
  params: Record<string, ParamValue> = {},
): FilterState {
  return {
    statuses: unique(splitParam(params.statuses)) as Shipment["status"][],
    regions: unique(splitParam(params.regions)),
    priorities: unique(splitParam(params.priorities)) as Shipment["priority"][],
    highRiskOnly: parseBoolean(params.highRiskOnly),
  } satisfies FilterState;
}

export function parseFilterStateFromSearchParams(searchParams: URLSearchParams): FilterState {
  const paramsObject: Record<string, string> = {};
  FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value !== null) {
      paramsObject[key] = value;
    }
  });
  return parseFilterStateFromObject(paramsObject);
}

export function serializeFilterState(
  filters: FilterState,
  base?: URLSearchParams | Readonly<URLSearchParams> | null,
) {
  const params = base ? new URLSearchParams(base.toString()) : new URLSearchParams();
  FILTER_KEYS.forEach((key) => params.delete(key));

  if (filters.statuses.length) {
    params.set("statuses", filters.statuses.join(","));
  }
  if (filters.regions.length) {
    params.set("regions", filters.regions.join(","));
  }
  if (filters.priorities.length) {
    params.set("priorities", filters.priorities.join(","));
  }
  if (filters.highRiskOnly) {
    params.set("highRiskOnly", "1");
  }

  return params;
}

export function toShipmentFilters(filters: FilterState): ShipmentFilters {
  return {
    statuses: filters.statuses.length ? filters.statuses : undefined,
    regions: filters.regions.length ? filters.regions : undefined,
    priorities: filters.priorities.length ? filters.priorities : undefined,
    highRiskOnly: filters.highRiskOnly ? true : undefined,
  } satisfies ShipmentFilters;
}
