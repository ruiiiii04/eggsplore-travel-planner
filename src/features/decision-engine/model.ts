export type Vote = "up" | "down";
export type Candidate = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  image?: string;
  cover: "bali" | "japan";
  up: number;
  down: number;
  confirmed?: boolean;
  ai?: boolean;
  source?: string;
};
export type Stop = {
  id: string;
  title: string;
  location: string;
  day: number;
  time: string;
  top?: boolean;
};
export type Pool = {
  candidates: Candidate[];
  votes: Record<string, Vote>;
  draft: Stop[] | null;
  published: Stop[] | null;
};
export const tags = [
  "Culture",
  "Nature",
  "Food",
  "Sightseeing",
  "Shopping",
  "Nightlife",
  "Beach",
  "Relax",
  "Adventure",
];
export function totals(c: Candidate, vote?: Vote) {
  const up = c.up + Number(vote === "up"),
    down = c.down + Number(vote === "down");
  return {
    up,
    down,
    total: up + down,
    percent: up + down ? Math.round((up / (up + down)) * 100) : 0,
    score: up - down,
  };
}
export function toggleVote(votes: Pool["votes"], id: string, vote: Vote) {
  const next = { ...votes };
  if (next[id] === vote) delete next[id];
  else next[id] = vote;
  return next;
}
export function seedCandidates(destination: string): Candidate[] {
  const japan = /tokyo|japan|osaka|kyoto/i.test(destination),
    bali = /bali|indonesia/i.test(destination);
  const places = japan
    ? /osaka/i.test(destination)
      ? [
          ["Universal Studios Japan", "Osaka", ["Adventure", "Sightseeing"]],
          ["Dotonbori", "Namba, Osaka", ["Food", "Nightlife"]],
          ["Osaka Castle", "Chuo, Osaka", ["Culture", "Nature"]],
          ["Kuromon Market", "Osaka", ["Food", "Shopping"]],
        ]
      : /kyoto/i.test(destination)
        ? [
            ["Fushimi Inari Shrine", "Kyoto", ["Culture", "Sightseeing"]],
            ["Arashiyama Bamboo Grove", "Kyoto", ["Nature", "Relax"]],
            ["Nishiki Market", "Kyoto", ["Food", "Shopping"]],
          ]
        : [
            ["TeamLab Planets", "Toyosu, Tokyo", ["Culture", "Sightseeing"]],
            ["Senso-ji Temple", "Asakusa, Tokyo", ["Culture", "Sightseeing"]],
            ["Shibuya Crossing", "Shibuya, Tokyo", ["Shopping", "Nightlife"]],
            ["Shinjuku Gyoen", "Shinjuku, Tokyo", ["Nature", "Relax"]],
            ["Tsukiji Outer Market", "Tokyo", ["Food", "Shopping"]],
            ["Tokyo Skytree", "Sumida, Tokyo", ["Sightseeing"]],
          ]
    : bali
      ? [
          [
            "Uluwatu Temple",
            "Bali, Indonesia",
            ["Culture", "Nature", "Sightseeing"],
          ],
          ["Nusa Dua Beach", "Bali, Indonesia", ["Beach", "Relax"]],
          [
            "Mount Batur Sunrise Trek",
            "Bali, Indonesia",
            ["Adventure", "Nature"],
          ],
          [
            "Tegenungan Waterfall",
            "Bali, Indonesia",
            ["Nature", "Sightseeing"],
          ],
          ["Seminyak Beach Club", "Bali, Indonesia", ["Food", "Nightlife"]],
          [
            "Ulun Danu Beratan Temple",
            "Bali, Indonesia",
            ["Culture", "Nature"],
          ],
        ]
      : [];
  return places.map((p, i) => ({
    id: `seed-${i}`,
    name: p[0] as string,
    location: p[1] as string,
    tags: p[2] as string[],
    cover: japan ? "japan" : "bali",
    up: 0,
    down: 0,
  }));
}
export function tripDays(start?: string | null, end?: string | null) {
  if (!start || !end) return 1;
  return Math.max(
    1,
    Math.min(
      30,
      Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
    ),
  );
}
/** A transparent vote-ranked starter, not a claim of AI or route optimisation. */
export function makeDraft(pool: Pool, days: number): Stop[] {
  return pool.candidates
    .filter((c) => pool.votes[c.id] !== "down" || c.confirmed)
    .sort(
      (a, b) =>
        Number(!!b.confirmed) - Number(!!a.confirmed) ||
        totals(b, pool.votes[b.id]).score - totals(a, pool.votes[a.id]).score,
    )
    .slice(0, days * 4)
    .map((c, i) => ({
      id: c.id,
      title: c.name,
      location: c.location,
      day: Math.floor(i / 4) + 1,
      time: ["09:00", "11:00", "14:00", "17:00"][i % 4],
      top: totals(c, pool.votes[c.id]).score > 0 && i === 0,
    }));
}
export function validTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function moveStop(stops: Stop[], id: string, offset: number) {
  const i = stops.findIndex((s) => s.id === id),
    j = i + offset;
  if (i < 0 || j < 0 || j >= stops.length || stops[i].day !== stops[j].day)
    return stops;
  const next = stops.map((s) => ({ ...s }));
  const time = next[i].time;
  next[i].time = next[j].time;
  next[j].time = time;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
