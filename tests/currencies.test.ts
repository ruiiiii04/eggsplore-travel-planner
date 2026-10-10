import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CURRENCIES,
  convertShares,
  formatMoney,
  parseRate,
  sanitizeAmount,
  searchCurrencies,
  toRM,
} from "../src/features/budget/currencies";

test("the currency table is valid and starts with RM", () => {
  assert.ok(CURRENCIES.length >= 40);
  assert.equal(CURRENCIES[0].code, "RM");
  assert.equal(CURRENCIES[0].rate, 1);
  assert.equal(new Set(CURRENCIES.map((c) => c.code)).size, CURRENCIES.length);
  for (const c of CURRENCIES) {
    assert.ok(c.rate > 0, c.code);
    assert.ok(c.decimals >= 0 && c.decimals <= 2, c.code);
  }
});

test("searching matches code or name in any case", () => {
  assert.equal(searchCurrencies("").length, CURRENCIES.length);
  assert.ok(searchCurrencies("yen").some((c) => c.code === "JPY"));
  assert.ok(searchCurrencies("USD").some((c) => c.code === "USD"));
  assert.ok(searchCurrencies("ringgit").some((c) => c.code === "RM"));
  assert.deepEqual(searchCurrencies("zzzz"), []);
});

test("amount input is limited to the currency's decimals", () => {
  assert.equal(sanitizeAmount("12.3456", 2), "12.34");
  assert.equal(sanitizeAmount("abc", 2), "");
  assert.equal(sanitizeAmount("1.2.3", 2), "1.23");
  assert.equal(sanitizeAmount("12.", 2), "12.");
  assert.equal(sanitizeAmount("1234.5", 0), "1234");
});

test("manual rates must be positive with at most six decimals", () => {
  assert.equal(parseRate("5.1"), 5.1);
  assert.equal(parseRate(" 0.0295 "), 0.0295);
  assert.equal(parseRate("0"), null);
  assert.equal(parseRate(""), null);
  assert.equal(parseRate("abc"), null);
  assert.equal(parseRate("1.1234567"), null);
  assert.equal(parseRate("-2"), null);
});

test("amounts convert to RM rounded to the cent", () => {
  assert.equal(toRM(10000, 0.03), 300);
  assert.equal(toRM(12.345, 4.4), 54.32);
});

test("converted shares always add up to the converted total", () => {
  assert.deepEqual(convertShares({ a: 6000, b: 4000 }, 0.03, 300), {
    a: 180,
    b: 120,
  });
  const awkward = convertShares({ a: 1, b: 1, c: 1 }, 3.333, toRM(3, 3.333));
  assert.deepEqual(awkward, { a: 3.34, b: 3.33, c: 3.33 });
  const sum = Object.values(awkward).reduce((s, v) => s + Math.round(v * 100), 0);
  assert.equal(sum, 1000);
  assert.deepEqual(convertShares({}, 4, 0), {});
});

test("money formats with the code and the currency's decimals", () => {
  assert.ok(formatMoney(300, "RM").startsWith("RM "));
  assert.ok(formatMoney(300, "RM").endsWith("300.00"));
  assert.ok(formatMoney(300, "JPY", 0).endsWith("300"));
});