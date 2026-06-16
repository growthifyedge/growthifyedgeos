// =============================================================================
// Period (month) helpers — all month values are standardized to the first day
// of the month as a plain "YYYY-MM-01" string. We build the string from local
// calendar parts (getFullYear / getMonth) and NEVER from toISOString(), so
// there are no timezone off-by-one-day shifts when filtering payroll by month.
// =============================================================================

/**
 * Normalize any Date or "YYYY-MM-..." string to "YYYY-MM-01".
 * Hardened: malformed or out-of-range input falls back to the current month,
 * so a garbage `?month=` query param can never reach the database as an
 * invalid date.
 */
export function toPeriodMonth(input: Date | string = new Date()): string {
  if (typeof input === "string") {
    // Take the year-month part directly; ignore any day/time/timezone.
    const m = input.match(/^(\d{4})-(\d{2})/);
    if (m) {
      const mm = Number(m[2]);
      if (mm >= 1 && mm <= 12) return `${m[1]}-${m[2]}-01`;
    }
    const parsed = new Date(input);
    input = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  const y = input.getFullYear();
  const mo = String(input.getMonth() + 1).padStart(2, "0");
  return `${y}-${mo}-01`;
}

/** The current month as "YYYY-MM-01". */
export function currentPeriodMonth(): string {
  return toPeriodMonth(new Date());
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Human label, e.g. "June 2026". Uses a fixed month-name table (not
 * locale-dependent Intl) so server and client render identical text — avoids
 * React hydration mismatches in client components like the month selector.
 */
export function monthLabel(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return period;
  const monthIndex = Number(m[2]) - 1;
  return `${MONTH_NAMES[monthIndex] ?? period} ${m[1]}`;
}

/** A list of the last `count` months (incl. current) as "YYYY-MM-01" strings. */
export function recentPeriodMonths(count = 12, from: Date = new Date()): string[] {
  const out: string[] = [];
  const year = from.getFullYear();
  const month = from.getMonth(); // 0-based
  for (let i = 0; i < count; i++) {
    const d = new Date(year, month - i, 1);
    out.push(toPeriodMonth(d));
  }
  return out;
}
