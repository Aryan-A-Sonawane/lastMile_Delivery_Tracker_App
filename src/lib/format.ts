export function formatMoney(n: number | string, currency = "INR"): string {
  const value = typeof n === "string" ? Number(n) : n;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
}
