import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  icon?: React.ReactNode;
  /** Period-over-period % change (positive = up/green). */
  delta?: number;
}) {
  const card = (
    <Card
      className={cn(
        "h-full",
        href && "group transition-colors hover:border-primary/50",
      )}
    >
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {href ? (
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          ) : (
            icon
          )}
        </div>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                delta >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500",
              )}
            >
              {delta >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
