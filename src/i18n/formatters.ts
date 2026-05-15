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
