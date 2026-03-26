import { FeedbackStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FeedbackBadgeProps {
  status?: FeedbackStatus | null;
  className?: string;
}

const CONFIG: Record<
  FeedbackStatus,
  { dot: string; label: string; text: string }
> = {
  confirmed: {
    dot: "bg-green-500",
    label: "Confirmed",
    text: "text-green-400",
  },
  corrected: {
    dot: "bg-amber-500",
    label: "Corrected",
    text: "text-amber-400",
  },
  pending: {
    dot: "bg-gray-600",
    label: "Pending",
    text: "text-gray-500",
  },
};

export function FeedbackBadge({ status, className }: FeedbackBadgeProps) {
  const cfg = status ? CONFIG[status] : CONFIG.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        cfg.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
