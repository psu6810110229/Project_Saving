import type { WidgetMember } from './widgetSnapshot';

/**
 * F1-broadcast-style one-liners for the team widget header. Every line is built
 * only from data the leaderboard already exposes per member (all-time `saved`,
 * `streak`, `loggedToday`) — no per-day/week amounts. Keep each line short so it
 * fits one line in the 2x2 cell; the widget also truncates as a final safety net.
 */

/** Compact baht, e.g. ฿900 / ฿3.2k / ฿1.2M. */
function k(n: number): string {
  const v = Math.round(Math.abs(n));
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `฿${(m >= 100 ? Math.round(m) : Number(m.toFixed(1))).toString()}M`;
  }
  if (v >= 1_000) {
    const t = v / 1_000;
    return `฿${(t >= 100 ? Math.round(t) : Number(t.toFixed(1))).toString()}k`;
  }
  return `฿${v.toLocaleString('en-US')}`;
}

/** Short display name so the headline never overruns the cell. */
function shortName(member: WidgetMember): string {
  if (member.isYou) return 'คุณ';
  const name = member.name.trim();
  return name.length > 8 ? `${name.slice(0, 8)}…` : name;
}

/** Hour-stable rotation seed from the snapshot timestamp. */
export function messageSeed(updatedAt: string): number {
  const ms = Date.parse(updatedAt);
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 3_600_000); // hours since epoch
}

/** Deterministic pick from a candidate list, tolerant of negative seeds. */
function pick(seed: number, list: string[]): string {
  if (list.length === 0) return '';
  return list[((seed % list.length) + list.length) % list.length];
}

/**
 * Pick one eligible race-commentary headline. `members` is expected high→low
 * but is re-sorted defensively; positions read as P1/P2/… like a real grid.
 * `seed` rotates the wording/scenario over time. Each line is kept short so it
 * fits one line in the 2x2 cell (the widget also truncates as a safety net).
 */
export function buildTeamMessage(members: WidgetMember[], seed: number): string {
  const racers = [...members].sort((a, b) => b.saved - a.saved);
  const p1 = racers[0];
  if (!p1) return '';

  const name1 = shortName(p1);

  // Solo room — one car on track.
  if (racers.length <= 1) {
    return pick(seed, [
      `${name1} ออกตัวเดี่ยว ลุยต่อ 🏁`,
      `${name1} ซ้อมรอบ รักษาฟอร์ม 💪`,
    ]);
  }

  const lead = p1.saved;

  // Lights out — nobody has banked anything yet.
  if (lead <= 0) {
    return pick(seed, [
      'ไฟเขียว ออกสตาร์ท! 🏁',
      'ทุกคนที่กริด ลุยเลย! 🏁',
    ]);
  }

  const p2 = racers[1];
  const name2 = shortName(p2);
  const gap12 = Math.max(0, p1.saved - p2.saved);

  const candidates: string[] = [];

  // --- Front of the grid: the fight for P1 ---
  if (gap12 <= Math.max(1, lead * 0.02)) {
    candidates.push(`${name1} กับ ${name2} สูสี! 🏎️`);
    candidates.push(`${name2} เบียด P1 สุดมัน! 🏎️`);
  } else if (gap12 <= lead * 0.1) {
    candidates.push(`${name2} จ่อแซง P1! +${k(gap12)}`);
    candidates.push(`${name2} ไล่บี้ P1 +${k(gap12)}`);
  } else if (gap12 >= lead * 0.3) {
    candidates.push(`${name1} นำโด่ง +${k(gap12)} 🏁`);
    candidates.push(`${name1} ครองโพล นำขาด 👑`);
  } else {
    candidates.push(`${name1} นำ P1 อยู่ +${k(gap12)} 👑`);
    candidates.push(`P1 ${name1} กดต่อเนื่อง 🏎️`);
  }

  // --- Midfield battle: tightest gap below the top pair ---
  let tight: { lowerName: string; rank: number; gap: number } | null = null;
  for (let i = 2; i < racers.length; i++) {
    const upper = racers[i - 1];
    const lower = racers[i];
    if (upper.saved <= 0) continue;
    const gap = upper.saved - lower.saved;
    if (gap > 0 && gap <= upper.saved * 0.12 && (tight == null || gap < tight.gap)) {
      tight = { lowerName: shortName(lower), rank: i + 1, gap };
    }
  }
  if (tight) {
    candidates.push(`${tight.lowerName} ไล่จี้ P${tight.rank - 1}! +${k(tight.gap)}`);
    candidates.push(`ศึก P${tight.rank} เดือด! +${k(tight.gap)}`);
  }

  // --- Hot form / streak ("on a charge") ---
  const hot = racers.reduce((best, m) => (m.streak ?? 0) > (best.streak ?? 0) ? m : best, p1);
  if ((hot.streak ?? 0) > 0) {
    candidates.push(`${shortName(hot)} ฟอร์มแรง ${hot.streak} วันติด 🔥`);
    candidates.push(`${shortName(hot)} ไฟแรง ${hot.streak} วันซ้อน 🔥`);
  }

  // --- Pit stop today (banked a deposit) ---
  const pitted = racers.find(m => m.loggedToday);
  if (pitted) candidates.push(`${shortName(pitted)} เข้าพิตเติมแล้ว ⚡`);

  // --- Charging through the field ---
  const charger = racers.find((m, i) => i > 0 && (m.streak ?? 0) >= 3);
  if (charger) candidates.push(`${shortName(charger)} มาแรงแซงโค้ง 🔥`);

  // --- You-relative drama ---
  const myIdx = racers.findIndex(m => m.isYou);
  if (myIdx >= 0) {
    const me = racers[myIdx];
    if (myIdx === 0) {
      const gapBelow = me.saved - racers[1].saved;
      candidates.push(gapBelow <= me.saved * 0.05
        ? `คุณนำหวุดหวิด +${k(gapBelow)}!`
        : 'คุณครอง P1 อยู่ 🏆');
    } else {
      const above = racers[myIdx - 1];
      const gapAbove = above.saved - me.saved;
      if (gapAbove > 0 && gapAbove <= above.saved * 0.15) {
        candidates.push(`อีก ${k(gapAbove)} คุณขึ้น P${myIdx}!`);
      }
      const below = racers[myIdx + 1];
      if (below && me.saved - below.saved <= me.saved * 0.1) {
        candidates.push(`ระวัง ${shortName(below)} จ่อแซงคุณ!`);
      }
      if (myIdx === racers.length - 1 && racers.length >= 3) {
        candidates.push('คุณรั้งท้าย เหยียบมิด! 🏎️');
      }
    }
  }

  if (candidates.length === 0) candidates.push(`${name1} นำขบวน ลุยต่อ! 🏁`);
  return pick(seed, candidates);
}
