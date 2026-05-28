import type { ImageUploadErrorCode } from '../hooks/useImageUpload';

interface RoomCoverCopy {
  coverTypeError: string;
  coverSizeError: string;
  coverAuthError: string;
  coverProcessError: string;
  coverUploadError: string;
}

export function roomCoverErrorMessage(
  code: ImageUploadErrorCode,
  copy: RoomCoverCopy,
  fallback?: string,
): string {
  if (code === 'invalid_type') return copy.coverTypeError;
  if (code === 'too_large') return copy.coverSizeError;
  if (code === 'not_authenticated') return copy.coverAuthError;
  if (code === 'decode_failed' || code === 'canvas_failed') return copy.coverProcessError;
  return fallback ?? copy.coverUploadError;
}
