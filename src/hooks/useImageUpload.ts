import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CoverTint } from '../types';

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

/** Neutral fallback used when pixel sampling is unavailable. */
const NEUTRAL_COVER_TINT: CoverTint = { rgb: [28, 22, 19], strength: 0.6 };

const REC709 = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

/**
 * Derive a readability tint from the cropped cover canvas: a deep,
 * slightly-desaturated shade of the image's own palette plus a strength
 * scaled by how bright the image is in the card's top/bottom text zones.
 * Bright zones -> stronger scrim; dark zones -> lighter. Falls back to a
 * neutral tint if the pixel data can't be read.
 */
function sampleCoverTint(ctx: CanvasRenderingContext2D, width: number, height: number): CoverTint {
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    const stepX = Math.max(1, Math.floor(width / 100));
    const stepY = Math.max(1, Math.floor(height / 100));
    const topLimit = height * 0.32;
    const bottomStart = height * 0.68;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    let topLumSum = 0, topCount = 0;
    let bottomLumSum = 0, bottomCount = 0;

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        rSum += r; gSum += g; bSum += b; count++;
        const lum = REC709.r * r + REC709.g * g + REC709.b * b;
        if (y < topLimit) { topLumSum += lum; topCount++; }
        else if (y > bottomStart) { bottomLumSum += lum; bottomCount++; }
      }
    }

    if (count === 0) return NEUTRAL_COVER_TINT;

    const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count;
    const avgLuma = REC709.r * avgR + REC709.g * avgG + REC709.b * avgB;
    // Desaturate toward the average luma, then darken into a deep shade.
    const desat = 0.45, darken = 0.3;
    const shade = (c: number) => {
      const pulled = avgLuma + (c - avgLuma) * desat;
      return Math.max(0, Math.min(255, Math.round(pulled * darken)));
    };

    const topLum = topCount ? topLumSum / topCount : avgLuma;
    const bottomLum = bottomCount ? bottomLumSum / bottomCount : avgLuma;
    const brightest = Math.max(topLum, bottomLum) / 255; // 0..1
    const strength = Math.max(0.3, Math.min(1, 0.35 + brightest * 0.65));

    return { rgb: [shade(avgR), shade(avgG), shade(avgB)], strength: Math.round(strength * 100) / 100 };
  } catch {
    return NEUTRAL_COVER_TINT;
  }
}

export interface CroppedCover {
  blob: Blob;
  tint: CoverTint;
}

export async function cropAndResizeRoomCover(file: File, crop: CropRect): Promise<CroppedCover> {
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
  const tint = sampleCoverTint(ctx, outputWidth, outputHeight);
  const blob = await canvasToBlob(canvas);
  return { blob, tint };
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
