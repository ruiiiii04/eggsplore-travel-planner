export type ActivityLocation = {
  provider: "geoapify" | "wikipedia" | "manual";
  providerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categories: string[];
};
export function parseLocation(value: unknown): ActivityLocation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!["geoapify", "wikipedia", "manual"].includes(String(row.provider)) ||
      typeof row.providerId !== "string" || row.providerId.length > 1500 ||
      typeof row.name !== "string" || !row.name.trim() || row.name.length > 200 ||
      typeof row.address !== "string" || row.address.length > 600 ||
      typeof row.latitude !== "number" || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90 ||
      typeof row.longitude !== "number" || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) return null;
  return {
    provider: row.provider as ActivityLocation["provider"], providerId: row.providerId,
    name: row.name, address: row.address, latitude: row.latitude, longitude: row.longitude,
    categories: Array.isArray(row.categories) ? [...new Set(row.categories.filter((s): s is string => typeof s === "string" && s.length <= 120))].slice(0, 20) : [],
  };
}
export function parseLocationParam(raw: string | undefined) {
  try { return raw ? parseLocation(JSON.parse(raw)) : null; } catch { return null; }
}
export function savedLocationColumns(location: ActivityLocation | null) {
  return {
    latitude: location?.latitude ?? null, longitude: location?.longitude ?? null,
    location_provider: location?.provider ?? null, location_provider_id: location?.providerId ?? null,
    location_address: location?.address ?? null, location_categories: location?.categories ?? [],
  };
}
