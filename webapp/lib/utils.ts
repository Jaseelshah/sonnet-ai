import { Priority } from "./types";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export const PRIORITY_BG_CLASSES: Record<Priority, string> = {
  CRITICAL: "bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/30",
  HIGH: "bg-[#FF8C00]/10 text-[#FF8C00] border-[#FF8C00]/30",
  MEDIUM: "bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30",
  LOW: "bg-[#00FFB2]/10 text-[#00FFB2] border-[#00FFB2]/30",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
