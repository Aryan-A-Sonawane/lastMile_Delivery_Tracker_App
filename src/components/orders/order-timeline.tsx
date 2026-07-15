import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "./status-badge";

export type TimelineEntry = {
  status: string;
  note?: string | null;
  actorRole?: string | null;
  createdAt: string | Date;
};

/** Vertical, immutable tracking timeline built from OrderStatusHistory rows. */
export function OrderTimeline({ history }: { history: TimelineEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No tracking events yet.</p>;
  }

  return (
    <ol className="relative ml-2 border-l pl-6">
      {history.map((h, i) => {
        const latest = i === history.length - 1;
        return (
          <li key={i} className="mb-5 last:mb-0">
            <span
              className={`absolute -left-[7px] mt-1 size-3.5 rounded-full border-2 border-background ${
                latest ? "bg-primary" : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-sm font-medium">
                {STATUS_LABELS[h.status] ?? h.status}
              </p>
              <time className="text-xs text-muted-foreground">
                {formatDateTime(h.createdAt)}
              </time>
            </div>
            {h.note && <p className="text-sm text-muted-foreground">{h.note}</p>}
            {h.actorRole && (
              <p className="text-xs text-muted-foreground/70">by {h.actorRole.toLowerCase()}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
