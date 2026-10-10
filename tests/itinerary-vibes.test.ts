import test from "node:test";
import assert from "node:assert/strict";
import { vibeTags } from "../supabase/functions/_shared/trip-places.ts";
test("vibes are multiple stored tags, not a replacement activity category", () => {
  assert.deepEqual(vibeTags({ activity_category: "sightseeing", description: null, vibe_tags: ["Heritage", "Nature"] }), ["Heritage", "Nature"]);
});
test("stored vibes are deduplicated and validated", () => {
  assert.deepEqual(vibeTags({ activity_category: "food", description: null, vibe_tags: ["Foodie", "Foodie", "Busy now"] }), ["Foodie"]);
});
test("unclassified is honest when no known tags exist", () => {
  assert.deepEqual(vibeTags({ activity_category: null, description: null, vibe_tags: [] }), ["Unclassified"]);
});
test("legacy response shapes map activity categories to vibe names", () => {
  assert.deepEqual(vibeTags({ activity_category: "food", description: null }), ["Foodie"]);
  assert.deepEqual(vibeTags({ activity_category: null, description: "category:stay" }), ["Stay"]);
});
