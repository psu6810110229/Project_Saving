import type { BucketCategory } from '../types';

export interface Accent {
  accent: string;
  tint: string;
  border: string;
}

// Per-card accent driven by the bucket's category, so each purpose reads as its
// own color family (icon, current amount, badge, border, and progress share it).
export const CATEGORY_ACCENT: Record<BucketCategory, Accent> = {
  flight:     { accent: '#3F9BB5', tint: '#E8F6FA', border: '#BFE4ED' }, // ฟ้าอม teal
  stay:       { accent: '#5F9A52', tint: '#EEF7EA', border: '#CBE4C4' }, // โรงแรม = เขียว
  transport:  { accent: '#F86C08', tint: '#FEF1E2', border: '#FCE0C0' }, // เดินทาง = ส้ม
  food:       { accent: '#287CF4', tint: '#E8F1FD', border: '#C0D8FC' }, // ของกิน = ฟ้า
  activities: { accent: '#D98A18', tint: '#FFF2DD', border: '#F2CB8E' }, // กิจกรรม = amber รอง
  shopping:   { accent: '#8B5CF6', tint: '#F1ECFD', border: '#D9CCFA' }, // ซื้อของ = ม่วง
  buffer:     { accent: '#D6A21E', tint: '#FFF5D8', border: '#EED28A' }, // emergency = เหลือง
  home:       { accent: '#D85C8A', tint: '#FCEAF1', border: '#EDB8CC' }, // บ้าน = ชมพู
  other:      { accent: '#D34A3A', tint: '#FDEAE7', border: '#EDB7AE' }, // อื่นๆ = แดง
};

export const DEFAULT_ACCENT: Accent = CATEGORY_ACCENT.home;
