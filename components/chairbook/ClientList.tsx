"use client";

import { eur, fmtDay } from "@/lib/chairbook/format";
import type { ClientInsight } from "@/lib/chairbook/selectors";
import { StatusBadge } from "./ClientDetail";
import { Empty, Row, Sheet } from "./ui";

/** A tappable list of clients behind a number. Each row opens the client. */
export function ClientListSheet({
  title,
  sub,
  items,
  onClose,
  onPick,
  footer,
}: {
  title: string;
  sub?: string;
  items: ClientInsight[];
  onClose: () => void;
  onPick: (i: ClientInsight) => void;
  footer?: React.ReactNode;
}) {
  return (
    <Sheet open onClose={onClose} title={title}>
      {sub && <p className="mb-3 text-xs text-ink-3">{sub}</p>}
      {items.length === 0 ? (
        <Empty>Nobody here.</Empty>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {items.map((i) => (
            <button key={i.client.id} className="block w-full text-left" onClick={() => onPick(i)}>
              <Row
                left={
                  <>
                    {i.client.name} <StatusBadge status={i.status} />
                  </>
                }
                sub={
                  i.visits
                    ? `${i.visits} visits · last ${fmtDay(i.lastVisit)} (${i.daysSince}d)${i.gapDays ? ` · every ${i.gapDays}d` : ""}`
                    : "no visits yet"
                }
                right={
                  <>
                    {eur(i.spend)}
                    {i.hasUpcoming && <div className="text-[11px] text-info">booked</div>}
                  </>
                }
              />
            </button>
          ))}
        </div>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </Sheet>
  );
}
