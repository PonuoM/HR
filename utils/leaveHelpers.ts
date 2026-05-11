export function formatLeaveDuration(
  days: number | string,
  workHoursPerDay: number = 8,
  startDate?: string,
  endDate?: string
): string {
  const d = parseFloat(String(days)) || 0;
  if (d === 0) return '0 วัน';

  // If essentially an integer
  if (Math.abs(d - Math.round(d)) < 0.01) {
    return `${Math.round(d)} วัน`;
  }

  const fullDays = Math.floor(d);
  const fraction = d - fullDays;
  let hours = 0;

  if (fraction > 0) {
    hours = fraction * workHoursPerDay;
  }

  // Round hours for safety to nearest 1 decimal point or int.
  // Actually, some fractions like 3/7 = 0.42857 -> * 7 = 3.000...
  hours = parseFloat(hours.toFixed(1));

  const parts = [];
  if (fullDays > 0) {
    parts.push(`${fullDays} วัน`);
  }
  if (hours > 0) {
    parts.push(`${Number.isInteger(hours) ? hours : hours.toFixed(1)} ชม.`);
  }

  return parts.join(' ') || '0 วัน';
}
