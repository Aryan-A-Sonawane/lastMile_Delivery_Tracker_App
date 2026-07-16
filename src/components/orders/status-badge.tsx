import { cn } from "@/lib/utils";

export const STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RESCHEDULED: "Rescheduled",
  RETURN_TO_SENDER: "Returned to sender",
};

const STATUS_STYLES: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PICKED_UP: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  IN_TRANSIT: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  OUT_FOR_DELIVERY: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  RESCHEDULED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  RETURN_TO_SENDER: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
