export const budgetLimits = { min: 1000, max: 10000, step: 100 };
export function parseBudget(value: string): [number, number] {
  const amounts =
    value.match(/\d[\d,]*/g)?.map((v) => Number(v.replace(/,/g, ""))) ?? [];
  return [amounts[0] || 1000, amounts[1] || 2000];
}
export function formatBudget(min: number, max: number) {
  return (
    "RM " +
    min.toLocaleString("en-MY") +
    " \u2013 RM " +
    max.toLocaleString("en-MY")
  );
}
export function adjustBudget(
  range: [number, number],
  bound: 0 | 1,
  amount: number,
): [number, number] {
  const rounded = Math.round(amount / budgetLimits.step) * budgetLimits.step;
  const next = Math.max(budgetLimits.min, Math.min(budgetLimits.max, rounded));
  return bound === 0
    ? [Math.min(next, range[1]), range[1]]
    : [range[0], Math.max(next, range[0])];
}
export function calendarCells(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++)
    cells.push(
      year +
        "-" +
        String(month + 1).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0"),
    );
  while (cells.length % 7) cells.push(null);
  return cells;
}
