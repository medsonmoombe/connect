import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely format a date string for display.
 * Returns a formatted date string, or '—' if the input is null/undefined/invalid.
 * Prevents "Invalid Date" from being shown to users.
 */
export function formatDate(dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, options);
}

/**
 * Safely format a full datetime (e.g., "15 Jan 2024, 14:30").
 * Falls back to '—' for invalid dates.
 */
export function formatUploadDate(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Safely format a full datetime for audit logs (includes seconds). */
export function formatAuditDate(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
