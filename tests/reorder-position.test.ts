import { test } from "node:test";
import assert from "node:assert/strict";
import { reorderPosition } from "../src/components/reorderPosition";
test("drag uses half a measured row to choose a drop position and stays within the day", () => {
 assert.equal(reorderPosition(2, 35, 72, 0, 4), 2);
 assert.equal(reorderPosition(2, 36, 72, 0, 4), 3);
 assert.equal(reorderPosition(2, -36, 72, 0, 4), 1);
 assert.equal(reorderPosition(2, -150, 72, 1, 4), 1);
 assert.equal(reorderPosition(2, 900, 72, 0, 4), 4);
 assert.equal(reorderPosition(2, 900, 0, 0, 4), 2);
 assert.equal(reorderPosition(2, NaN, 72, 0, 4), 2);
});
