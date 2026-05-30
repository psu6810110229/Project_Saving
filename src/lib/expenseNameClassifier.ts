/**
 * Lightweight, Thai-context classifier that turns a bucket NAME (and its
 * budget) into a short, natural saving/planning suggestion for the wizard's
 * step-4 timeline.
 *
 * Matching is intentionally simple (substring/regex) and checks specific
 * transport modes BEFORE the generic "ค่าเดินทาง / travel" fallback — a bucket
 * literally named "ค่าเดินทาง" must NOT be assumed to be a flight. The generic
 * case is then refined by budget: a large share reads as a flight / long-haul
 * train, a small one as local rides or fuel.
 */

export interface ExpenseSuggestion {
  en: string;
  th: string;
}

interface KeywordGroup {
  test: RegExp;
  suggestion: ExpenseSuggestion;
}

// Specific groups, checked in order — first match wins. Flight is matched
// before "activities" so "เที่ยวบิน" reads as a flight, not sightseeing; food
// is matched before shopping so the default "อาหารและช็อปปิ้ง" reads as food.
const SPECIFIC_GROUPS: KeywordGroup[] = [
  {
    test: /เครื่องบิน|ตั๋วเครื่อง|ตั๋วบิน|เที่ยวบิน|สายการบิน|บิน|flight|airfare|airline|airplane|plane/i,
    suggestion: {
      en: 'Airfare is usually cheapest 3–6 months ahead — set a price alert and book early.',
      th: 'ตั๋วเครื่องบินมักถูกสุดช่วง 3–6 เดือนก่อนเดินทาง ตั้งแจ้งเตือนราคาแล้วจองแต่เนิ่นๆ',
    },
  },
  {
    test: /รถไฟ|train|railway/i,
    suggestion: {
      en: 'Book train tickets ahead, especially over long weekends and holidays.',
      th: 'จองตั๋วรถไฟล่วงหน้า โดยเฉพาะช่วงวันหยุดยาวที่คนเยอะ',
    },
  },
  {
    test: /รถทัวร์|รถบัส|รถตู้|รถโดยสาร|bus|coach|\bvan\b/i,
    suggestion: {
      en: 'Buses and vans are cheaper — book online early for a good seat.',
      th: 'รถทัวร์/รถตู้ราคาถูกกว่า จองออนไลน์ล่วงหน้าจะได้ที่นั่งดี',
    },
  },
  {
    test: /เรือ|เฟอร์รี|ferry|boat|speedboat/i,
    suggestion: {
      en: 'Check ferry times and book ahead in high season — they fill up fast.',
      th: 'เช็กรอบเรือและจองล่วงหน้าช่วงไฮซีซัน คนมักเต็มเร็ว',
    },
  },
  {
    test: /น้ำมัน|เชื้อเพลิง|ปั๊ม|fuel|petrol|\bgas\b|gasoline/i,
    suggestion: {
      en: 'Estimate your round-trip distance so you budget enough for fuel.',
      th: 'กะระยะทางไป-กลับให้ดี จะได้ตั้งงบค่าน้ำมันพอดี',
    },
  },
  {
    test: /เช่ารถ|รถเช่า|car rental|rental car|rent a car/i,
    suggestion: {
      en: 'Compare a few rental firms and remember insurance and fuel on top.',
      th: 'เทียบราคารถเช่าหลายเจ้า อย่าลืมเผื่อค่าประกันและน้ำมัน',
    },
  },
  {
    test: /ที่พัก|โรงแรม|รีสอร์|เกสต์เฮาส์|หอพัก|hotel|hostel|resort|airbnb|guesthouse|lodging|\bstay\b/i,
    suggestion: {
      en: 'Book a free-cancellation room early so you can rebook if prices drop.',
      th: 'จองที่พักแบบยกเลิกฟรีไว้ก่อน ถ้าราคาลดค่อยจองใหม่ได้',
    },
  },
  {
    test: /อาหาร|กิน|ข้าว|มื้อ|คาเฟ่|ร้านอาหาร|food|meal|dining|restaurant|cafe/i,
    suggestion: {
      en: 'Budget per meal — local spots and markets stretch it much further.',
      th: 'ตั้งงบเป็นรายมื้อ กินร้านท้องถิ่นและตลาดช่วยประหยัดได้มาก',
    },
  },
  {
    test: /ช็อป|ช้อป|ของฝาก|ของที่ระลึก|ซื้อของ|shopping|souvenir/i,
    suggestion: {
      en: 'Set a shopping limit up front so you don’t overspend.',
      th: 'ตั้งงบช้อปไว้ก่อน จะได้ไม่เผลอใช้เกินตัว',
    },
  },
  {
    test: /กิจกรรม|ทัวร์|ตั๋วเข้า|บัตรเข้า|สวนสนุก|ดำน้ำ|เที่ยว|activity|activities|\btour\b|attraction|admission/i,
    suggestion: {
      en: 'Book popular activities early — the best ones sell out fast.',
      th: 'จองกิจกรรมยอดฮิตล่วงหน้า ที่นิยมมักเต็มเร็ว',
    },
  },
  {
    test: /ซิม|อินเทอร์เน็ต|เน็ต|\bsim\b|esim|wifi|internet|roaming/i,
    suggestion: {
      en: 'Grab a travel SIM or eSIM before you go — easier than queuing on arrival.',
      th: 'ซื้อซิมท่องเที่ยวหรือ eSIM ก่อนเดินทาง สะดวกกว่าไปต่อคิวหน้างาน',
    },
  },
  {
    test: /ประกัน|insurance/i,
    suggestion: {
      en: 'Travel insurance is cheap peace of mind — set aside a little.',
      th: 'ประกันเดินทางราคาไม่แพง ช่วยอุ่นใจ เผื่องบไว้สักนิด',
    },
  },
  {
    test: /วีซ่า|พาสปอร์ต|หนังสือเดินทาง|visa|passport/i,
    suggestion: {
      en: 'Check visa fees and processing time early, then apply well ahead.',
      th: 'เช็กค่าวีซ่าและระยะเวลาทำการล่วงหน้า แล้วยื่นแต่เนิ่นๆ',
    },
  },
  {
    test: /สำรอง|ฉุกเฉิน|เผื่อ|buffer|emergency|reserve|contingency/i,
    suggestion: {
      en: 'Keep a buffer for surprises — medical bills, rebooking, or a must-do you didn’t plan.',
      th: 'กันเงินสำรองเผื่อเหตุไม่คาดฝัน เช่น ค่ารักษาหรือค่าเปลี่ยนตั๋ว',
    },
  },
];

// Generic transport — only reached when no specific mode matched above.
const GENERIC_TRANSPORT_RE = /ค่าเดินทาง|การเดินทาง|เดินทาง|ค่ารถ|transport|travel|commute|transit/i;

function transportByBudget(amount: number): ExpenseSuggestion {
  if (amount >= 8000) {
    return {
      en: 'A budget this size usually means a flight or long-distance train — book ahead for the best price.',
      th: 'งบระดับนี้น่าจะเป็นตั๋วเครื่องบินหรือรถไฟทางไกล จองล่วงหน้าได้ราคาดีกว่า',
    };
  }
  if (amount >= 1500) {
    return {
      en: 'Could be a bus, train, or ferry — compare the options and book ahead.',
      th: 'อาจเป็นรถทัวร์ รถไฟ หรือเรือ ลองเทียบราคาแล้วจองล่วงหน้า',
    };
  }
  return {
    en: 'Likely local rides or fuel — estimate your round-trip distance to set the amount.',
    th: 'น่าจะเป็นค่ารถในพื้นที่หรือน้ำมัน กะระยะทางไป-กลับเพื่อตั้งจำนวนเงิน',
  };
}

/** Fallback so every expense shows at least one short, sensible suggestion. */
export const GENERIC_SUGGESTION: ExpenseSuggestion = {
  en: 'Set this aside a little each payday so it’s ready in time.',
  th: 'ทยอยเก็บทีละนิดทุกงวดเงินเดือน จะได้พร้อมทันเวลา',
};

/**
 * Returns a tailored suggestion for the given bucket name, or `null` when the
 * name matches nothing (callers fall back to a category tip / GENERIC_SUGGESTION).
 * Pass the amount so generic "ค่าเดินทาง" buckets can be refined by budget.
 */
export function classifyExpenseName(name: string, amount = 0): ExpenseSuggestion | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  for (const group of SPECIFIC_GROUPS) {
    if (group.test.test(n)) return group.suggestion;
  }
  if (GENERIC_TRANSPORT_RE.test(n)) return transportByBudget(amount);
  return null;
}
