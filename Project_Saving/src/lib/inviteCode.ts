// Unambiguous chars — no 0/O, 1/I, 5/S, 2/Z confusion
const CHARS = 'ABCDEFGHJKLMNPQRTUVWXY346789';

/**
 * Generates a random 6-character uppercase invite code.
 * Uses unambiguous characters to avoid visual confusion.
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
