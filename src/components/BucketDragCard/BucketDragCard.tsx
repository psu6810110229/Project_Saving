import { useCallback, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Transform } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';

interface BucketDragCardProps {
  id: string;
  children: ReactNode;
  /** Show a subtle shimmer to hint that this card is draggable. */
  showDragHint?: boolean;
}

interface DragBounds {
  card: DOMRect;
  boundary: DOMRect;
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return value;
  return Math.min(Math.max(value, min), max);
}

function clampTransformToBounds(
  transform: Transform,
  bounds: DragBounds | null,
  scale: number,
): Transform {
  if (!bounds) return transform;

  const { card, boundary } = bounds;
  const scaledWidthOffset = (card.width * (scale - 1)) / 2;
  const scaledHeightOffset = (card.height * (scale - 1)) / 2;

  return {
    ...transform,
    x: clamp(
      transform.x,
      boundary.left - card.left + scaledWidthOffset,
      boundary.right - card.right - scaledWidthOffset,
    ),
    y: clamp(
      transform.y,
      boundary.top - card.top + scaledHeightOffset,
      boundary.bottom - card.bottom - scaledHeightOffset,
    ),
  };
}

function readDragBounds(node: HTMLDivElement): DragBounds {
  const boundary = node.closest<HTMLElement>('[data-bucket-drag-boundary="true"]');
  return {
    card: node.getBoundingClientRect(),
    boundary: (boundary ?? document.documentElement).getBoundingClientRect(),
  };
}

/**
 * Wraps a bucket card with both draggable and droppable behavior so any
 * own active bucket can be a transfer source or destination. The drop
 * itself never moves money — Dashboard reads `onDragEnd` and opens the
 * BucketTransferSheet prefilled with the source/destination ids
 * (plan 40 §5.4 "Drag Shortcut").
 *
 * Tap behavior is preserved by the sensor activation delay configured on
 * the parent DndContext: a quick tap still propagates the click to the
 * underlying Pressable, while a hold-and-drag enters drag mode.
 */
export function BucketDragCard({ id, children, showDragHint }: BucketDragCardProps) {
  const reduceMotion = useReducedMotion();
  const [dragBounds, setDragBounds] = useState<DragBounds | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
    transform,
  } = useDraggable({ id });
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({ id });

  const sameBucket = active?.id === id;
  const validTarget = isOver && !sameBucket;
  // Reduced motion skips the lift entirely; otherwise stay within the
  // 1.01–1.02 range called out in plan §12 so the card feels picked up
  // without bouncing.
  const liftScale = reduceMotion ? 1 : 1.02;
  const constrainedTransform = transform
    ? clampTransformToBounds(transform, dragBounds, isDragging ? liftScale : 1)
    : null;
  // Calm cubic-bezier eases the settle after a drag and the highlight
  // fade for valid targets. Matches the brand-soft motion language.
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const style: CSSProperties = {
    transform: constrainedTransform
      ? `translate3d(${constrainedTransform.x}px, ${constrainedTransform.y}px, 0) scale(${isDragging ? liftScale : 1})`
      : undefined,
    zIndex: isDragging ? 50 : undefined,
    transition: isDragging
      ? 'none'
      : reduceMotion
        ? `box-shadow 120ms linear, opacity 120ms linear`
        : `transform 180ms ${ease}, box-shadow 180ms ${ease}, opacity 180ms ${ease}`,
    touchAction: 'manipulation',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // Reduced motion keeps the ring tighter (no offset) so the state
  // change reads as a calm highlight instead of a glow shimmer.
  const ringClass = validTarget
    ? reduceMotion
      ? 'ring-2 ring-brand-500'
      : 'ring-2 ring-brand-500 ring-offset-2 ring-offset-bg'
    : '';
  const liftClass = isDragging ? 'shadow-neuRaised opacity-95' : '';
  const setBucketNodeRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setDragBounds(readDragBounds(node));
    }
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setDragBounds(readDragBounds(event.currentTarget));
  }, []);

  return (
    <div
      ref={setBucketNodeRef}
      style={style}
      className={`relative rounded-2xl ${liftClass} ${ringClass}`.trim()}
      onPointerDownCapture={handlePointerDownCapture}
      {...attributes}
      {...listeners}
    >
      {children}
      {showDragHint && !isDragging && !reduceMotion && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'bucketDragShimmer 2.4s ease-in-out infinite',
          }}
        />
      )}
      {showDragHint && !isDragging && reduceMotion && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-200"
        />
      )}
    </div>
  );
}
