export type EmojiKey = 'fire' | 'heart' | 'clap';

export const EMOJI_MAP: Record<EmojiKey, string> = {
  fire:  '',
  heart: '',
  clap:  '�',
};

export const EMOJI_KEYS = Object.keys(EMOJI_MAP) as EmojiKey[];

export interface ReactionPing {
  logId: string;
  fromUserId: string;
  emoji: EmojiKey;
  sentAt: number;
}
