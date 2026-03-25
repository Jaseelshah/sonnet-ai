import { cn, PRIORITY_BG_CLASSES } from '@/lib/utils';
import { Priority } from '@/lib/types';

export interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
  className?: string;
}

const PRIORITY_DOTS: Record<Priority, string> = {
  CRITICAL: 'bg-[#FF4444]',
  HIGH: 'bg-[#FF8C00]',
  MEDIUM: 'bg-[#FFD700]',
  LOW: 'bg-[#00FFB2]',
};

export function PriorityBadge({ priority, size = 'md', className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold border rounded-md',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        PRIORITY_BG_CLASSES[priority],
        className
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
          PRIORITY_DOTS[priority],
          priority === 'CRITICAL' && 'animate-pulse'
        )}
      />
      {priority}
    </span>
  );
}
