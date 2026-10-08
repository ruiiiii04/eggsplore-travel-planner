import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requestWithTimeout,
  RequestTimeoutError,
} from "../src/lib/requestTimeout";
test("stalled requests time out and abort without leaving the caller waiting", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(
    requestWithTimeout((s) => {
      signal = s;
      return new Promise<never>(() => {});
    }, 10),
    RequestTimeoutError,
  );
  assert.equal(signal?.aborted, true);
});
test("successful responses and underlying failures are preserved", async () => {
  assert.deepEqual(
    await requestWithTimeout(
      async () => ({ data: "published", error: null }),
      100,
    ),
    { data: "published", error: null },
  );
  const error = { message: "Only the Group Leader can publish" };
  await assert.rejects(
    requestWithTimeout(async () => {
      throw error;
    }, 100),
    (value) => value === error,
  );
});
