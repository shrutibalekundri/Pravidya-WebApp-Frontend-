import { format as dateFnsFormat } from 'date-fns';

/**
 * Format duration (minutes) as "Xh Ym" - standard format across the app.
 * Always shows hours and minutes for consistency.
 * Examples: 45 → "0h 45m", 60 → "1h 0m", 90 → "1h 30m"
 */
export function formatDuration(minutes) {
  const totalMins = Math.round(Number(minutes) || 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m}m`;
}

/**
 * Standard date-time format: "MMM d, yyyy, h:mm a" (e.g., "Feb 20, 2026, 3:45 PM")
 */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return dateFnsFormat(d, 'MMM d, yyyy, h:mm a');
}

/**
 * Standard time-only format: "h:mm a" (e.g., "3:45 PM")
 */
export function formatTimeOnly(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return dateFnsFormat(d, 'h:mm a');
}
