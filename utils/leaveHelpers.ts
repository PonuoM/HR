// Format leave duration following HR rule: 0.5 day = "ครึ่งวัน", whole days = "X วัน",
// fractional days (legacy data) show as "X.X วัน". Old _workHoursPerDay/dates kept
// for backward compat but unused — kept to avoid breaking call sites.
export function formatLeaveDuration(
  days: number | string,
  _workHoursPerDay: number = 8,
  _startDate?: string,
  _endDate?: string
): string {
  const d = parseFloat(String(days)) || 0;
  if (d === 0) return '0 วัน';

  // Integer days
  if (Math.abs(d - Math.round(d)) < 0.01) {
    return `${Math.round(d)} วัน`;
  }

  const fullDays = Math.floor(d);
  const fraction = d - fullDays;

  // Half day → "ครึ่งวัน"
  if (Math.abs(fraction - 0.5) < 0.01) {
    return fullDays === 0 ? 'ครึ่งวัน' : `${fullDays} วัน ครึ่ง`;
  }

  // Other fractional values (legacy data not yet migrated) — show as decimal, trim trailing zeros
  const rounded = Math.round(d * 100) / 100;
  const str = Number.isInteger(rounded) ? rounded.toString() : parseFloat(rounded.toFixed(2)).toString();
  return `${str} วัน`;
}
