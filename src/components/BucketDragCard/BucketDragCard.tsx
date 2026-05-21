import type { CSSProperties, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useReducedMotion } from 'framer-motion';

interface BucketDragCardProps {
  id: string;
  children: ReactNode;
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
export function BucketDragCard({ id, children }: BucketDragCardProps) {
  const reduceMotion = useReducedMotion();
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
  const liftScale = reduceMotion ? 1 : 1.02;

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? liftScale : 1})`
      : undefined,
    zIndex: isDragging ? 50 : undefined,
    transition: isDragging ? 'none' : 'transform 160ms ease, box-shadow 160ms ease',
    touchAction: 'manipulation',
  };

  const ringClass = validTarget
    ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-bg'
    : '';
  const liftClass = isDragging ? 'shadow-neuRaised opacity-95' : '';

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={style}
      className={`relative rounded-2xl ${liftClass} ${ringClass}`.trim()}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
