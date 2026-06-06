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

/**
 * Pick one eligible headline. `members` is expected high→low but is re-sorted
 * defensively. `seed` rotates the chosen template over time.
 */
export function buildTeamMessage(members: WidgetMember[], seed: number): string {
  const sorted = [...members].sort((a, b) => b.saved - a.saved);
  const leader = sorted[0];
  if (!leader) return '';

  const leaderName = shortName(leader);
  if (sorted.length <= 1) return `${leaderName} กำลังไปได้สวย 💪`;

  const second = sorted[1];
  const secondName = shortName(second);
  const gap = Math.max(0, leader.saved - second.saved);

  const topStreaker = sorted.reduce((best, m) =>
    (m.streak ?? 0) > (best.streak ?? 0) ? m : best, sorted[0]);
  const savedToday = sorted.find(m => m.loggedToday);
  const risingStar = sorted.find((m, i) => i > 0 && (m.streak ?? 0) >= 3);

  const candidates: string[] = [];
  if (gap > 0) candidates.push(`${leaderName} นำอยู่ ${k(gap)} 👑`);
  if (leader.saved > 0 && gap <= Math.max(1, leader.saved * 0.03)) {
    candidates.push(`${leaderName} กับ ${secondName} สูสีมาก!`);
  }
  if (gap > 0 && gap <= leader.saved * 0.1) {
    candidates.push(`${secondName} จ่อแซง! อีก ${k(gap)}`);
  }
  if ((topStreaker.streak ?? 0) > 0) {
    candidates.push(`${shortName(topStreaker)} สตรีค ${topStreaker.streak} วันติด 🔥`);
  }
  if (savedToday) candidates.push(`${shortName(savedToday)} เก็บแล้ววันนี้ ⚡`);
  if (risingStar) candidates.push(`${shortName(risingStar)} กำลังมาแรง 🔥`);

  if (candidates.length === 0) return `${leaderName} กำลังไปได้สวย 💪`;
  return candidates[((seed % candidates.length) + candidates.length) % candidates.length];
}
