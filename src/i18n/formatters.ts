import type { Language } from './languages';

export function formatMoney(amount: number, _language: Language): string {
  void _language;
  return '฿' + amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatRelativeTime(iso: string, language: Language): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (language === 'th') {
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    return `${Math.floor(hrs / 24)} วันที่แล้ว`;
  }
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Localized "28 May" / "28 พ.ค." style label for Bangkok-local
 * day keys (YYYY-MM-DD). Used by Saving Plan / Reconcile UI where
 * the date string comes from plan helpers rather than a timestamp.
 */
export function formatShortDateKey(dateKey: string, language: Language): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
  const date = new Date(Date.UTC(y, m - 1, d));
  const locale = language === 'th' ? 'th-TH' : 'en-GB';
  return date.toLocaleDateString(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Localized "28 May 2026" (EN) / "28 พ.ค. 2026" (TH) label for a
 * `room_members.joined_at` timestamptz. Used by the Manage Project
 * Members section to show when each member joined the room. The year
 * stays because join dates can be from previous years for long-running
 * rooms; cropping it would hide useful context.
 *
 * Defensive: returns an empty string for `null` / invalid ISO so the
 * caller can substitute a fallback string (e.g. "Joined recently").
 */
export function formatJoinedDate(iso: string | null | undefined, language: Language): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'th' ? 'th-TH' : 'en-GB';
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLocalDateLabel(iso: string, language: Language): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (language === 'th') {
    if (sameDay(date, today)) return 'วันนี้';
    if (sameDay(date, yesterday)) return 'เมื่อวาน';
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
