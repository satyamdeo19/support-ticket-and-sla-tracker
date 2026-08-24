import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  // Try to handle raw timestamps or ISO strings
  const timestamp = parseInt(dateStr, 10);
  const date = !isNaN(timestamp) && String(timestamp).length > 10 
      ? new Date(timestamp) 
      : new Date(dateStr);
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
