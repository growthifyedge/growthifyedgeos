/** Format an amount as currency, with a safe fallback for unknown codes. */
export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}
