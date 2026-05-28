import { type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
import { IconButton } from '../IconButton/IconButton';
import { IconEdit } from '../Icon/Icon';

interface SortableBucketCardProps {
  id: string;
  children: ReactNode;
  /** When set, shows a pencil button (top-right) that opens bucket editing. */
  onEdit?: () => void;
  editAriaLabel?: string;
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
export function SortableBucketCard({ id, children, onEdit, editAriaLabel }: SortableBucketCardProps) {
  const reduceMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const rootStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'manipulation',
  };

  const shouldWiggle = !isDragging && !reduceMotion;
  const innerStyle: CSSProperties = shouldWiggle
    ? { animationDelay: `${wiggleSeed(id) * 180}ms` }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={rootStyle}
      className={`relative rounded-2xl ${isDragging ? 'shadow-neuRaised' : ''}`.trim()}
      {...attributes}
      {...listeners}
    >
      <div className={shouldWiggle ? 'bucket-edit-wiggle' : ''} style={innerStyle}>
        {children}
      </div>
      {onEdit && (
        <IconButton
          type="button"
          variant="solid"
          size="sm"
          ariaLabel={editAriaLabel ?? 'Edit bucket'}
          className="absolute -right-1.5 -top-1.5 z-10"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <IconEdit size={14} />
        </IconButton>
      )}
    </div>
  );
}
