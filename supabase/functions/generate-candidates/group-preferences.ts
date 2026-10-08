// @ts-ignore -- Deno imports use explicit .ts extensions.
import { memberCategoryWeights } from "../_shared/preference-weights.ts";
type Row = Record<string, unknown>;
const object = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const text = (v: unknown) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 100) : "";
const list = (v: unknown) =>
  Array.isArray(v) ? v.map(text).filter(Boolean) : [];
const categoryLabels: Record<string, string> = {
  beach: "Beach",
  backpacking: "Adventure",
  city: "Culture and sightseeing",
  road: "Road trips",
};
export function summarizeGroupPreferences(input: unknown) {
  const members = Array.isArray(input) ? input : [];
  const interestScores = new Map<
    string,
    { interest: string; members: number; score: number }
  >();
  const paceCounts = new Map<string, number>();
  const companionCounts = new Map<string, number>();
  const spendingScores = new Map<string, number>();
  let membersWithPreferences = 0;
  const categoryScores: Record<string, number> = {};
  for (const member of members) {
    const profiles = object(member).profiles;
    for (const [category, weight] of Object.entries(
      memberCategoryWeights(profiles),
    ))
      categoryScores[category] = (categoryScores[category] ?? 0) + weight;
    const interests = new Map<string, string>();
    const paces = new Set<string>(),
      companions = new Set<string>();
    const spending = new Map<string, number>();
    for (const raw of Array.isArray(profiles) ? profiles : []) {
      const profile = object(raw);
      const category = text(profile.category);
      for (const term of [
        ...list(profile.tags),
        ...list(profile.interests),
        ...(category ? [categoryLabels[category] || category] : []),
      ])
        interests.set(term.toLowerCase(), term);
      const pace = text(profile.pace);
      if (pace) paces.add(pace === "Packed" ? "Intense" : pace);
      const companion = text(profile.companion);
      if (companion) companions.add(companion);
      const order = list(profile.spendingOrder);
      order.forEach((term, index) =>
        spending.set(
          term,
          Math.max(
            spending.get(term) ?? 0,
            (order.length - index) / order.length,
          ),
        ),
      );
    }
    if (
      !interests.size &&
      !paces.size &&
      !companions.size &&
      !spending.size &&
      !Object.keys(memberCategoryWeights(profiles)).length
    )
      continue;
    membersWithPreferences++;
    for (const [key, interest] of interests) {
      const previous = interestScores.get(key) ?? {
        interest,
        members: 0,
        score: 0,
      };
      previous.members++;
      previous.score += 1 / interests.size;
      interestScores.set(key, previous);
    }
    for (const pace of paces)
      paceCounts.set(pace, (paceCounts.get(pace) ?? 0) + 1 / paces.size);
    for (const companion of companions)
      companionCounts.set(
        companion,
        (companionCounts.get(companion) ?? 0) + 1 / companions.size,
      );
    const sum = [...spending.values()].reduce((a, b) => a + b, 0);
    for (const [term, score] of spending)
      spendingScores.set(term, (spendingScores.get(term) ?? 0) + score / sum);
  }
  return {
    membersTotal: members.length,
    membersWithPreferences,
    categoryWeights: Object.fromEntries(
      Object.entries(categoryScores).map(([c, w]) => [
        c,
        w / Math.max(1, membersWithPreferences),
      ]),
    ),
    interests: [...interestScores.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ interest, members, score }) => ({
        interest,
        members,
        weight:
          Math.round((score / Math.max(1, membersWithPreferences)) * 10000) /
          10000,
      })),
    travelPace: Object.fromEntries(paceCounts),
    companionTypes: Object.fromEntries(companionCounts),
    spendingPriorities: Object.fromEntries(spendingScores),
  };
}
