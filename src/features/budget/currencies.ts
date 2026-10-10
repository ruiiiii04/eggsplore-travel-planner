// rate = how many RM one unit of the currency is worth. These are rough
// placeholder rates, not live prices: edit them before the demo.
export type Currency = {
  code: string;
  name: string;
  rate: number;
  decimals: number;
};

export type CurrencySelection = {
  code: string;
  rate: number;
  decimals: number;
  custom: boolean;
};

export const CURRENCIES: Currency[] = [
  { code: "RM", name: "Malaysian Ringgit", rate: 1, decimals: 2 },
  { code: "USD", name: "US Dollar", rate: 4.4, decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", rate: 3.3, decimals: 2 },
  { code: "EUR", name: "Euro", rate: 4.8, decimals: 2 },
  { code: "JPY", name: "Japanese Yen", rate: 0.03, decimals: 0 },
  { code: "GBP", name: "British Pound", rate: 5.7, decimals: 2 },
  { code: "AUD", name: "Australian Dollar", rate: 2.8, decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", rate: 2.5, decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", rate: 3.1, decimals: 2 },
  { code: "CHF", name: "Swiss Franc", rate: 5.3, decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", rate: 0.6, decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", rate: 0.56, decimals: 2 },
  { code: "TWD", name: "Taiwan Dollar", rate: 0.14, decimals: 2 },
  { code: "KRW", name: "South Korean Won", rate: 0.0031, decimals: 0 },
  { code: "THB", name: "Thai Baht", rate: 0.13, decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", rate: 0.00026, decimals: 0 },
  { code: "VND", name: "Vietnamese Dong", rate: 0.00017, decimals: 0 },
  { code: "PHP", name: "Philippine Peso", rate: 0.075, decimals: 2 },
  { code: "INR", name: "Indian Rupee", rate: 0.05, decimals: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", rate: 0.014, decimals: 2 },
  { code: "NPR", name: "Nepalese Rupee", rate: 0.031, decimals: 2 },
  { code: "PKR", name: "Pakistani Rupee", rate: 0.015, decimals: 2 },
  { code: "BDT", name: "Bangladeshi Taka", rate: 0.036, decimals: 2 },
  { code: "KHR", name: "Cambodian Riel", rate: 0.00105, decimals: 0 },
  { code: "LAK", name: "Lao Kip", rate: 0.0002, decimals: 0 },
  { code: "MMK", name: "Myanmar Kyat", rate: 0.002, decimals: 0 },
  { code: "BND", name: "Brunei Dollar", rate: 3.3, decimals: 2 },
  { code: "AED", name: "UAE Dirham", rate: 1.2, decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", rate: 1.17, decimals: 2 },
  { code: "QAR", name: "Qatari Riyal", rate: 1.2, decimals: 2 },
  { code: "ILS", name: "Israeli Shekel", rate: 1.2, decimals: 2 },
  { code: "TRY", name: "Turkish Lira", rate: 0.1, decimals: 2 },
  { code: "EGP", name: "Egyptian Pound", rate: 0.088, decimals: 2 },
  { code: "MAD", name: "Moroccan Dirham", rate: 0.46, decimals: 2 },
  { code: "ZAR", name: "South African Rand", rate: 0.24, decimals: 2 },
  { code: "SEK", name: "Swedish Krona", rate: 0.44, decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", rate: 0.42, decimals: 2 },
  { code: "DKK", name: "Danish Krone", rate: 0.64, decimals: 2 },
  { code: "ISK", name: "Icelandic Krona", rate: 0.034, decimals: 0 },
  { code: "CZK", name: "Czech Koruna", rate: 0.2, decimals: 2 },
  { code: "PLN", name: "Polish Zloty", rate: 1.1, decimals: 2 },
  { code: "HUF", name: "Hungarian Forint", rate: 0.012, decimals: 0 },
  { code: "MXN", name: "Mexican Peso", rate: 0.23, decimals: 2 },
  { code: "BRL", name: "Brazilian Real", rate: 0.78, decimals: 2 },
];

export function selectionFor(currency: Currency): CurrencySelection {
  return {
    code: currency.code,
    rate: currency.rate,
    decimals: currency.decimals,
    custom: false,
  };
}

export const DEFAULT_CURRENCY: CurrencySelection = selectionFor(CURRENCIES[0]);

export function findCurrency(code: string | null | undefined): Currency | null {
  return CURRENCIES.find((c) => c.code === code) ?? null;
}

export function searchCurrencies(query: string): Currency[] {
  const text = query.trim().toLowerCase();
  if (!text) return CURRENCIES;
  return CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(text) || c.name.toLowerCase().includes(text),
  );
}

// Digits only, one decimal point, and no more decimals than the currency uses.
export function sanitizeAmount(text: string, decimals: number): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (decimals <= 0) return cleaned.split(".")[0];
  const [intPart, ...rest] = cleaned.split(".");
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join("").slice(0, decimals)}`;
}

// How many RM one unit is worth: a positive number with up to 6 decimals.
export function parseRate(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

export function toRM(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

// Converts each person's share to RM. Rounding each share separately can leave
// the total a cent off, so the difference goes to the largest share.
export function convertShares(
  shares: Record<string, number>,
  rate: number,
  totalRM: number,
): Record<string, number> {
  const ids = Object.keys(shares);
  if (ids.length === 0) return {};
  const cents: Record<string, number> = {};
  for (const id of ids) cents[id] = Math.round(shares[id] * rate * 100);
  const diff =
    Math.round(totalRM * 100) - ids.reduce((sum, id) => sum + cents[id], 0);
  if (diff !== 0) {
    const largest = ids.reduce(
      (best, id) => (cents[id] > cents[best] ? id : best),
      ids[0],
    );
    cents[largest] += diff;
  }
  const result: Record<string, number> = {};
  for (const id of ids) result[id] = cents[id] / 100;
  return result;
}

export function formatMoney(amount: number, code: string, decimals = 2): string {
  return `${code} ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}