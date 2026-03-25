import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'up') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path d="M8 3l5 5H3l5-5z" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path d="M8 13L3 8h10l-5 5z" />
      </svg>
    );
  }
  return <span className="w-3 h-3 block rounded-full bg-current" />;
}

export function StatCard({
  label,
  value,
  subtext,
  accent = false,
  trend,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-gray-800 bg-gray-900/50 p-5 overflow-hidden',
        accent && 'border-[#00FFB2]/20 bg-[#00FFB2]/5',
        className
      )}
    >
      {/* Subtle top accent line */}
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00FFB2]/40 to-transparent" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-500 truncate">
            {label}
          </p>
          <p
            className={cn(
              'mt-2 text-3xl font-bold tabular-nums',
              accent ? 'text-[#00FFB2]' : 'text-white'
            )}
          >
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-gray-500 truncate">{subtext}</p>
          )}
          {trend && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                trend.direction === 'up' && 'text-[#FF4444]',
                trend.direction === 'down' && 'text-[#00FFB2]',
                trend.direction === 'neutral' && 'text-gray-400'
              )}
            >
              <TrendArrow direction={trend.direction} />
              {trend.label}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg',
              accent
                ? 'bg-[#00FFB2]/10 text-[#00FFB2]'
                : 'bg-gray-800 text-gray-400'
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
