import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Modal } from '../Modal/Modal';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconCheck, IconImage, IconZoomIn, IconZoomOut } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import type { CropRect } from '../../hooks/useImageUpload';

interface ImageCropperProps {
  open: boolean;
  file: File | null;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onApply: (crop: CropRect) => void;
  aspectRatio?: number;
  title?: string;
  applyLabel?: string;
  uploadingLabel?: string;
}

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getBaseScale(frame: Size, natural: Size): number {
  if (frame.width <= 0 || frame.height <= 0 || natural.width <= 0 || natural.height <= 0) {
    return 1;
  }
  return Math.max(frame.width / natural.width, frame.height / natural.height);
}

export function ImageCropper({
  open,
  file,
  saving = false,
  error,
  onCancel,
  onApply,
  aspectRatio = 16 / 9,
  title,
  applyLabel,
  uploadingLabel,
}: ImageCropperProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<Point | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open || !frameRef.current) return;

    const element = frameRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setFrameSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const baseScale = useMemo(
    () => getBaseScale(frameSize, naturalSize),
    [frameSize, naturalSize],
  );
  const imageScale = baseScale * zoom;

  const clampOffset = useCallback((candidate: Point, nextZoom = zoom): Point => {
    const scale = baseScale * nextZoom;
    const maxX = Math.max(0, (naturalSize.width * scale - frameSize.width) / 2);
    const maxY = Math.max(0, (naturalSize.height * scale - frameSize.height) / 2);

    return {
      x: clamp(candidate.x, -maxX, maxX),
      y: clamp(candidate.y, -maxY, maxY),
    };
  }, [baseScale, frameSize, naturalSize, zoom]);

  const resolvedOffset = useMemo(
    () => clampOffset(offset),
    [clampOffset, offset],
  );

  const crop = useMemo<CropRect | null>(() => {
    if (
      frameSize.width <= 0 ||
      frameSize.height <= 0 ||
      naturalSize.width <= 0 ||
      naturalSize.height <= 0 ||
      imageScale <= 0
    ) {
      return null;
    }

    const width = frameSize.width / imageScale;
    const height = frameSize.height / imageScale;
    const x = naturalSize.width / 2 - width / 2 - resolvedOffset.x / imageScale;
    const y = naturalSize.height / 2 - height / 2 - resolvedOffset.y / imageScale;

    return {
      x: clamp(x, 0, Math.max(0, naturalSize.width - width)),
      y: clamp(y, 0, Math.max(0, naturalSize.height - height)),
      width: clamp(width, 1, naturalSize.width),
      height: clamp(height, 1, naturalSize.height),
    };
  }, [frameSize, imageScale, naturalSize, resolvedOffset]);

  const imageStyle = useMemo<CSSProperties>(() => ({
    width: naturalSize.width > 0 ? naturalSize.width : undefined,
    height: naturalSize.height > 0 ? naturalSize.height : undefined,
    maxWidth: 'none',
    maxHeight: 'none',
    transform: `translate(-50%, -50%) translate(${resolvedOffset.x}px, ${resolvedOffset.y}px) scale(${imageScale})`,
    transformOrigin: 'center',
  }), [imageScale, naturalSize, resolvedOffset]);

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    setNaturalSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }

  function adjustZoom(delta: number) {
    setZoom(prev => {
      const next = clamp(Number((prev + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
      setOffset(current => clampOffset(current, next));
      return next;
    });
  }

  function handleZoomInput(event: ChangeEvent<HTMLInputElement>) {
    const next = clamp(Number(event.currentTarget.value), MIN_ZOOM, MAX_ZOOM);
    setZoom(next);
    setOffset(current => clampOffset(current, next));
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    adjustZoom(event.deltaY > 0 ? -0.08 : 0.08);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (saving) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    const points = Array.from(pointersRef.current.values());
    if (points.length === 1) {
      dragRef.current = point;
      pinchRef.current = null;
    } else if (points.length >= 2) {
      pinchRef.current = { distance: distance(points[0], points[1]), zoom };
      dragRef.current = null;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId) || saving) return;

    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2 && pinchRef.current) {
      const startDistance = Math.max(1, pinchRef.current.distance);
      const nextDistance = Math.max(1, distance(points[0], points[1]));
      const nextZoom = clamp(pinchRef.current.zoom * (nextDistance / startDistance), MIN_ZOOM, MAX_ZOOM);
      setZoom(nextZoom);
      setOffset(current => clampOffset(current, nextZoom));
      return;
    }

    if (points.length === 1 && dragRef.current) {
      const dx = point.x - dragRef.current.x;
      const dy = point.y - dragRef.current.y;
      dragRef.current = point;
      setOffset(current => clampOffset({ x: current.x + dx, y: current.y + dy }));
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    const points = Array.from(pointersRef.current.values());

    if (points.length === 1) {
      dragRef.current = points[0];
      pinchRef.current = null;
    } else {
      dragRef.current = null;
      pinchRef.current = null;
    }
  }

  function handleApply() {
    if (!crop || saving) return;
    onApply(crop);
  }

  return (
    <Modal
      open={open}
      title={title ?? c.cropCoverTitle}
      onClose={saving ? () => undefined : onCancel}
      closeOnBackdrop={false}
    >
      <div className="space-y-4">
        <div
          ref={frameRef}
          className="relative w-full touch-none overflow-hidden rounded-xl bg-well shadow-soft"
          style={{ aspectRatio }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="absolute left-1/2 top-1/2 select-none"
              draggable={false}
              style={imageStyle}
              onLoad={handleImageLoad}
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-dim">
              <IconImage size={32} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/45" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            onClick={() => adjustZoom(-0.1)}
            disabled={saving || zoom <= MIN_ZOOM}
            aria-label={c.zoomOutLabel}
          >
            <IconZoomOut size={18} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={handleZoomInput}
            disabled={saving}
            aria-label={c.zoomLabel}
            className="min-w-0 flex-1 accent-brand-600"
          />
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            onClick={() => adjustZoom(0.1)}
            disabled={saving || zoom >= MAX_ZOOM}
            aria-label={c.zoomInLabel}
          >
            <IconZoomIn size={18} />
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            {error}
          </p>
        )}

        <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
          <Button
            variant="primary"
            size="md"
            onClick={handleApply}
            disabled={!crop || saving}
            leadingIcon={!saving ? <IconCheck size={16} /> : undefined}
          >
            {saving ? (uploadingLabel ?? c.uploadingCover) : (applyLabel ?? c.applyCoverButton)}
          </Button>
          <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={onCancel} disabled={saving}>
            {c.cancelCoverButton}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
