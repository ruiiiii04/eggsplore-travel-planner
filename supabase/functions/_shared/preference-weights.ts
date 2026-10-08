export const preferenceCategories = [
  "Culture",
  "Nature",
  "Food",
  "Sightseeing",
  "Shopping",
  "Nightlife",
  "Beach",
  "Relax",
  "Adventure",
] as const;
export type CategoryWeights = Record<string, number>;
const row = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const aliases: Record<string, string[]> = {
  beach: ["Beach", "Relax"],
  backpacking: ["Adventure", "Nature"],
  city: ["Culture", "Sightseeing"],
  road: ["Adventure", "Nature"],
  "street food hunting": ["Food"],
  "specialty coffee & cafes": ["Food"],
  "local cuisine": ["Food"],
  "beauty & cosmetics": ["Shopping"],
  "pop culture & merchandise": ["Shopping"],
  "local markets": ["Shopping", "Food"],
  "pc gaming & arcades": ["Adventure"],
  "live music": ["Nightlife"],
  "museums & galleries": ["Culture"],
  "scenic photography": ["Nature", "Sightseeing"],
  "intense sports": ["Adventure"],
  "easy sightseeing": ["Sightseeing"],
  scenery: ["Nature"],
  wellness: ["Relax"],
  coffee: ["Food"],
};
export function canonicalCategories(term: string): string[] {
  const direct = preferenceCategories.find(
    (c) => c.toLowerCase() === term.trim().toLowerCase(),
  );
  return direct ? [direct] : (aliases[term.trim().toLowerCase()] ?? []);
}
// Normalize each profile, then average profiles. Extra profiles never multiply a member's influence.
export function memberCategoryWeights(profiles: unknown): CategoryWeights {
  const vectors: CategoryWeights[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(profiles) ? profiles : []) {
    const p = row(raw),
      vector: CategoryWeights = {},
      explicit = row(p.categoryWeights);
    const hasExplicit = Object.keys(explicit).some(
      (k) => canonicalCategories(k).length,
    );
    if (hasExplicit) {
      for (const [key, value] of Object.entries(explicit)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        for (const c of canonicalCategories(key))
          vector[c] = Math.max(0, Math.min(100, value));
      }
    } else {
      const terms = [
        ...(Array.isArray(p.tags) ? p.tags : []),
        ...(Array.isArray(p.interests) ? p.interests : []),
        p.category,
      ];
      for (const term of terms)
        if (typeof term === "string")
          for (const c of canonicalCategories(term)) vector[c] = 1;
    }
    const sum = Object.values(vector).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      const normalized = Object.fromEntries(
        Object.entries(vector)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([c, v]) => [c, v / sum]),
      );
      const key = JSON.stringify(normalized);
      if (!seen.has(key)) {
        vectors.push(normalized);
        seen.add(key);
      }
    }
  }
  const result: CategoryWeights = {};
  for (const vector of vectors)
    for (const [c, v] of Object.entries(vector))
      result[c] = (result[c] ?? 0) + v / vectors.length;
  return result;
}
// One signed vote contributes 1..2 points. Saved interest affects strength, never reverses a dislike.
export function preferenceVoteWeight(
  tags: string[],
  weights: CategoryWeights,
): number {
  const categories = new Set(tags.flatMap(canonicalCategories));
  if (!categories.size || !Object.keys(weights).length) return 1;
  return (
    1 +
    Math.min(
      1,
      [...categories].reduce((sum, c) => sum + (weights[c] ?? 0), 0),
    )
  );
}
