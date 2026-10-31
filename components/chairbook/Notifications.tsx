"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDay, fmtTime, isSameDay } from "@/lib/chairbook/format";
import { notificationsFor, type Notification, type NotificationKind } from "@/lib/chairbook/selectors";
import { useChairbook } from "@/lib/chairbook/store";
import { Badge, Button, Empty, Sheet, cx } from "./ui";

const KIND: Record<NotificationKind, { label: string; tone: "info" | "good" | "bad" | "warn" | "neutral" }> = {
  booking: { label: "Booking", tone: "info" },
  tip: { label: "Tip", tone: "good" },
  "no-show": { label: "No-show", tone: "bad" },
  card: { label: "Card", tone: "warn" },
  slipping: { label: "Clients", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function readKey(userId: string) {
  return `chairbook.notifRead.${userId}`;
}

export function useNotifications() {
  const { db, user, me, meClient } = useChairbook();
  const [readAt, setReadAt] = useState<string>("");
  useEffect(() => {
    if (!user) return;
    try {
      setReadAt(localStorage.getItem(readKey(user.id)) ?? "");
    } catch {
      setReadAt("");
    }
  }, [user]);
  const items: Notification[] = user
    ? notificationsFor(db, { role: user.role, barberId: me?.id, clientId: meClient?.id })
    : [];
  const unread = items.filter((n) => n.at > readAt).length;
  const markAllRead = useCallback(() => {
    if (!user) return;
    const now = new Date().toISOString();
    try {
      localStorage.setItem(readKey(user.id), now);
    } catch {
      /* ignore */
    }
    setReadAt(now);
  }, [user]);
  return { items, unread, readAt, markAllRead };
}

export function NotificationBell() {
  const { items, unread, readAt, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-line-2 bg-surface text-ink-2 hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-ink-3">{unread ? `${unread} new` : "You're up to date"}</span>
          {unread > 0 && (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <Empty>Nothing yet. New bookings, tips, no-shows and unassigned card payments show up here.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {items.map((n) => (
              <Link
                key={n.id}
                href={`/madbarbers/${n.href}`}
                onClick={() => {
                  markAllRead();
                  setOpen(false);
                }}
                className={cx("flex items-start gap-3 py-2.5", n.at > readAt && "font-medium")}
              >
                <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.at > readAt ? "bg-info" : "bg-transparent")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <span className="truncate">{n.title}</span>
                    <Badge tone={KIND[n.kind].tone}>{KIND[n.kind].label}</Badge>
                  </div>
                  <div className="truncate text-xs font-normal text-ink-3">{n.body}</div>
                </div>
                <span className="shrink-0 text-[11px] font-normal tabular-nums text-ink-3">
                  {isSameDay(n.at, new Date()) ? fmtTime(n.at) : fmtDay(n.at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
