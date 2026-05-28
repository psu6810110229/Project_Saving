import { useCallback, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Transform } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
import { IconButton } from '../IconButton/IconButton';
import { IconTrash } from '../Icon/Icon';

interface SortableBucketCardProps {
  id: string;
  children: ReactNode;
  /** When set, shows a trash button (top-left) that starts the soft-delete (archive) flow. */
  onRemove?: () => void;
  removeAriaLabel?: string;
  /** Tapping the card body (not the trash button, not a drag) opens bucket editing. */
  onCardClick?: () => void;
  /** While true, plays the "Gone" exit (shrink + fade) animation. */
  removing?: boolean;
  /** Hide the trash button (e.g. once tapped, while the remove flow is pending). */
  hideRemoveButton?: boolean;
}

interface DragBounds {
  card: DOMRect;
  boundary: DOMRect;
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return value;
  return Math.min(Math.max(value, min), max);
}

// Keep the dragged card's translate within the grid boundary so it can't be
// pushed off the screen edge. Mirrors the transfer-mode clamp in BucketDragCard.
function clampTransformToBounds(transform: Transform, bounds: DragBounds | null): Transform {
  if (!bounds) return transform;
  const { card, boundary } = bounds;
  return {
    ...transform,
    x: clamp(transform.x, boundary.left - card.left, boundary.right - card.right),
    y: clamp(transform.y, boundary.top - card.top, boundary.bottom - card.bottom),
  };
}

function readDragBounds(node: HTMLElement): DragBounds {
  const boundary = node.closest<HTMLElement>('[data-bucket-drag-boundary="true"]');
  return {
    card: node.getBoundingClientRect(),
    boundary: (boundary ?? document.documentElement).getBoundingClientRect(),
  };
}

// Deterministic 0..1 seed from the id so each card's wiggle is offset
// slightly — keeps the grid from jiggling in perfect unison.
function wiggleSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

/**
 * Edit-mode bucket card. Uses `@dnd-kit/sortable` so cards auto-fill
 * (shift to make room) as one is dragged. The sortable `translate`
 * transform lives on the root; the iOS-style wiggle `rotate` lives on
 * an inner wrapper so the two transforms never collide.
 */
export function SortableBucketCard({ id, children, onRemove, removeAriaLabel, onCardClick, removing, hideRemoveButton }: SortableBucketCardProps) {
  const reduceMotion = useReducedMotion();
  const [dragBounds, setDragBounds] = useState<DragBounds | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setDragBounds(readDragBounds(event.currentTarget));
  }, []);

  const displayTransform = isDragging ? clampTransformToBounds(transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1 }, dragBounds) : transform;

  const rootStyle: CSSProperties = {
    transform: CSS.Transform.toString(displayTransform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'manipulation',
  };

  const shouldWiggle = !isDragging && !reduceMotion && !removing;
  const innerStyle: CSSProperties = shouldWiggle
    ? { animationDelay: `${wiggleSeed(id) * 180}ms` }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={rootStyle}
      className={`relative rounded-2xl ${isDragging ? 'shadow-neuRaised' : ''}`.trim()}
      onPointerDownCapture={handlePointerDownCapture}
      {...attributes}
      {...listeners}
    >
      <div
        className={removing ? 'bucket-gone' : shouldWiggle ? 'bucket-edit-wiggle' : ''}
        style={innerStyle}
        onClick={removing ? undefined : onCardClick}
      >
        {children}
      </div>
      {onRemove && !removing && !hideRemoveButton && (
        <IconButton
          type="button"
          variant="solid"
          size="sm"
          ariaLabel={removeAriaLabel ?? 'Remove bucket'}
          className="absolute -left-0 -top-0 z-10 bg-danger/90 text-danger hover:bg-danger/35"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <IconTrash size={15} />
        </IconButton>
      )}
    </div>
  );
}
