import type { BucketCategory } from '../types';

export interface ExpenseTip {
  en: string;
  th: string;
}

export const expenseTips: Record<string, ExpenseTip> = {
  flight_booking_window: {
    en: 'International flights are cheapest 3-6 months before departure. Set fare alerts early and book when prices dip.',
    th: 'ตั๋วเครื่องบินระหว่างประเทศมักถูกสุด 3-6 เดือนก่อนเดินทาง ตั้งแจ้งเตือนราคาแล้วจองเมื่อราคาลง',
  },
  flight_price_drop: {
    en: 'Midweek flights (Tue-Thu) are often cheaper. Flexible dates can save 10-30% on airfare.',
    th: 'เที่ยวบินกลางสัปดาห์ (อังคาร-พฤหัส) มักถูกกว่า วันที่ยืดหยุ่นช่วยประหยัดค่าตั๋ว 10-30%',
  },
  stay_early_bird: {
    en: 'Hotels offer early-bird discounts 2-4 months ahead. Pick free cancellation so you can rebook if prices drop.',
    th: 'โรงแรมมักมีส่วนลด early-bird ล่วงหน้า 2-4 เดือน เลือกที่ยกเลิกฟรีได้ จะได้จองใหม่ถ้าราคาลด',
  },
  stay_alternatives: {
    en: 'Hostels, guesthouses, and vacation rentals can cut accommodation costs by half compared to hotels.',
    th: 'โฮสเทล เกสต์เฮาส์ และที่พักเช่ารายวันช่วยลดค่าที่พักได้ครึ่งหนึ่งเทียบกับโรงแรม',
  },
  transport_passes: {
    en: 'Rail passes and airport transfers save money when bought in advance. Check if multi-day transport passes exist.',
    th: 'บัตรรถไฟและรถรับส่งสนามบินถูกกว่าเมื่อซื้อล่วงหน้า เช็คว่าจุดหมายมีบัตรเดินทางรายวันหรือไม่',
  },
  transport_local: {
    en: 'Public transit is almost always cheaper than taxis. Download transit apps for your destination before you go.',
    th: 'ขนส่งสาธารณะถูกกว่าแท็กซี่เสมอ โหลดแอปขนส่งของจุดหมายไว้ก่อนเดินทาง',
  },
  food_per_meal: {
    en: 'Budget per meal, not per day. Street food and local markets stretch your food budget much further.',
    th: 'ตั้งงบเป็นมื้อแทนเป็นวัน อาหารข้างทางและตลาดท้องถิ่นช่วยประหยัดค่าอาหารได้มาก',
  },
  food_grocery: {
    en: 'Convenience stores and supermarkets are great for breakfast and snacks, saving restaurant costs for bigger meals.',
    th: 'ร้านสะดวกซื้อและซูเปอร์มาร์เก็ตเหมาะสำหรับมื้อเช้าและของว่าง เก็บงบร้านอาหารไว้มื้อใหญ่',
  },
  activities_advance: {
    en: 'Popular attractions sell out weeks ahead. Book must-do activities early and leave budget for spontaneous finds.',
    th: 'สถานที่ยอดนิยมมักเต็มล่วงหน้าหลายสัปดาห์ จองกิจกรรมสำคัญแต่เนิ่นๆ แล้วเผื่องบสำหรับของที่เจอระหว่างทาง',
  },
  activities_free: {
    en: 'Many cities have free walking tours, museums, and parks. Mix paid and free activities to stretch your budget.',
    th: 'หลายเมืองมีทัวร์เดินฟรี พิพิธภัณฑ์ฟรี และสวนสาธารณะ ผสมกิจกรรมเสียเงินกับฟรีเพื่อยืดงบ',
  },
  shopping_budget: {
    en: 'Set a fixed shopping budget before you go. Knowing your limit upfront prevents impulse spending.',
    th: 'ตั้งงบช้อปปิ้งไว้ก่อนเดินทาง รู้ขีดจำกัดล่วงหน้าช่วยกันการใช้จ่ายเกินตัว',
  },
  shopping_tax_free: {
    en: 'Check tax-free shopping thresholds at your destination. Receipts from qualifying stores can save 5-10%.',
    th: 'เช็คเกณฑ์ tax-free ที่จุดหมาย ใบเสร็จจากร้านที่เข้าร่วมช่วยประหยัดได้ 5-10%',
  },
  buffer_emergency: {
    en: 'An emergency buffer covers surprises: medical costs, rebooking fees, or a must-try experience you did not plan for.',
    th: 'เงินสำรองฉุกเฉินครอบคลุมเรื่องไม่คาดคิด: ค่ารักษา ค่าเปลี่ยนตั๋ว หรือประสบการณ์ที่ต้องลองแต่ไม่ได้วางแผนไว้',
  },
  buffer_insurance: {
    en: 'Travel insurance is cheaper than an emergency. Budget a small amount for peace of mind.',
    th: 'ประกันเดินทางถูกกว่าค่าใช้จ่ายฉุกเฉิน ตั้งงบเล็กน้อยเพื่อความอุ่นใจ',
  },
};

const CATEGORY_TIP_KEYS: Record<BucketCategory, string[]> = {
  flight: ['flight_booking_window', 'flight_price_drop'],
  stay: ['stay_early_bird', 'stay_alternatives'],
  transport: ['transport_passes', 'transport_local'],
  food: ['food_per_meal', 'food_grocery'],
  activities: ['activities_advance', 'activities_free'],
  shopping: ['shopping_budget', 'shopping_tax_free'],
  buffer: ['buffer_emergency', 'buffer_insurance'],
  home: [],
  other: [],
};

export function getTipKeysForCategory(category: BucketCategory): string[] {
  return CATEGORY_TIP_KEYS[category] ?? [];
}

export function getPrimaryTipKey(category: BucketCategory): string | null {
  const keys = CATEGORY_TIP_KEYS[category];
  return keys.length > 0 ? keys[0] : null;
}
