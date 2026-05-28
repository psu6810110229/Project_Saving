import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const ROOM_COVER_MAX_SIZE = 10 * 1024 * 1024;
export const ROOM_COVER_MAX_WIDTH = 1200;
export const ROOM_COVER_ASPECT_RATIO = 16 / 9;

const ALLOWED_ROOM_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageUploadErrorCode =
  | 'not_authenticated'
  | 'invalid_type'
  | 'too_large'
  | 'decode_failed'
  | 'canvas_failed'
  | 'upload_failed';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UploadResult {
  url?: string;
  error?: string;
  errorCode?: ImageUploadErrorCode;
}

export function validateRoomCoverFile(file: File): ImageUploadErrorCode | null {
  if (!ALLOWED_ROOM_COVER_TYPES.has(file.type)) return 'invalid_type';
  if (file.size > ROOM_COVER_MAX_SIZE) return 'too_large';
  return null;
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    throw new Error('decode_failed', { cause: error });
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('canvas_failed'));
      },
      'image/jpeg',
      0.9,
    );
  });
}

export async function cropAndResizeRoomCover(file: File, crop: CropRect): Promise<Blob> {
  const source = await decodeImage(file);
  const outputWidth = Math.max(1, Math.min(ROOM_COVER_MAX_WIDTH, Math.round(crop.width)));
  const outputHeight = Math.round(outputWidth / ROOM_COVER_ASPECT_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    source.close();
    throw new Error('canvas_failed');
  }

  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  source.close();
  return canvasToBlob(canvas);
}

export function useImageUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  async function uploadRoomCover(blob: Blob): Promise<UploadResult> {
    if (!user) return { error: 'Not authenticated', errorCode: 'not_authenticated' };

    setUploading(true);
    try {
      const path = `${user.id}/cover-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('room-covers')
        .upload(path, blob, {
          upsert: true,
          cacheControl: '3600',
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        return {
          error: uploadError.message,
          errorCode: 'upload_failed',
        };
      }

      const { data } = supabase.storage.from('room-covers').getPublicUrl(path);
      return { url: data.publicUrl };
    } finally {
      setUploading(false);
    }
  }

  return {
    uploading,
    validateRoomCoverFile,
    cropAndResizeRoomCover,
    uploadRoomCover,
  };
}
