# Mad Barbers — bookings, till & barber deals (MVP)

Served at **`/madbarbers`**. A self-contained section of this Next.js app for
running multi-location barbershops: bookings, a till that records every cut as
cash or card, per-barber deals, end-of-day settlement, and walk-in insights.

## What it does today

| Role | Login | What they see |
|------|-------|---------------|
| Owner | `owner` / `1234` | Dashboard (gross, shop net, barber payouts, cash vs card, per-barber settlement), Calendar for every barber, Till + JCC inbox, Clients, Team & deals, Insights, shop switcher |
| Barber | `andreas`, `kyriakos`, `marios`, `stelios` / `1111` | **My chair** (income, expenses, net, settlement, clients served, regulars, slipping/lost clients, no-shows, top clients, week pattern), Today, Till, their clients only, Expenses |
| Client | `nikos` / `0000` | Book an appointment, upcoming & past visits |

**The Done flow.** After a cut the barber taps *Done* on the appointment (or
*Done · walk-in*): who it was (my client / walk-in / shop client, name
optional), the amount with quick chips, a tip, cash or card. The split is
shown live and saved on the ledger row, so the owner sees the same numbers
with no end-of-day reconciliation. Tips go 100% to the barber.

**Notifications.** Derived from the data, not stored (`notificationsFor()`):
new online bookings, today's tips, no-shows, unassigned JCC card payments and
a daily "clients slipping away" summary. Read state is per device
(`chairbook.notifRead.<userId>`).

**Deals.** Each barber has two rules: one for *clients they bring* and one for
*walk-ins / shop clients*. A rule is either a flat amount to the shop
(e.g. €5 per cut) or a percentage split (50/50, 60/40 …). The split is
computed at the moment a payment is recorded and stored on the ledger row, so
changing a deal later never rewrites history (`lib/chairbook/deals.ts`).

**Who a client belongs to** decides which deal applies. Unknown walk-ins are
recorded with no client; the barber can register them as their own client
(own deal) or as a shop client (walk-in deal) from the till or the clients page.

**Cash vs card.** Every payment is tagged `cash` or `card`. Card payments can be
matched to an event from the JCC terminal (amount, time, last 4 digits). The
*JCC terminal inbox* lists terminal payments nobody has assigned yet.

**Settlement.** Assumes the barber keeps the cash they took and card money
lands in the shop account. `net = barber share − cash collected`. Positive →
shop pays the barber; negative → barber hands cash to the shop.

**Expenses.** Shop overheads (rent, utilities, supplies) are logged by the
owner per shop; each barber logs their own costs (products, tools, transport).
Owner sees *profit = shop net − shop expenses*; a barber sees *net = their
share − their expenses*.

**Client retention.** `clientInsights()` in `lib/chairbook/selectors.ts`
gives every client a status from their own visit rhythm (median gap between
visits): *new*, *regular* (≥3 visits, gap ≤21 days), *occasional*, *slipping*
(overdue by >1.5× their gap, at least 14 days) and *lost* (>2.5× their gap and
≥28 days, or >60 days). An upcoming booking clears slipping/lost. No-shows are
counted per client. Barbers only ever see their own clients and the shop
clients they personally served, never a colleague's list.

**Mobile.** The app is phone-first: bottom tab bar, bottom sheets (portaled
to `<body>`), card lists instead of tables under 640px, a sticky Done /
Book bar on the barber's Today screen.

**Theme.** Light/dark toggle in the header; stored per device
(`chairbook.theme`). Colors are semantic Tailwind tokens (`bg-surface`,
`text-ink`, `text-good` …) backed by `--cb-*` CSS variables in
`app/globals.css`; don't use raw `slate-*` classes inside chairbook.

**Insights.** Average booked vs walk-in visits per weekday (last 8 weeks),
visits by hour, cash/card split, shop comparison, and a booking-policy
suggestion: weekdays with ≥40% walk-in share are flagged "keep slots open".

## How it's built

```
app/(chairbook)/layout.tsx              third root layout (own <html>/<body>)
app/(chairbook)/madbarbers/page.tsx      login
app/(chairbook)/madbarbers/(app)/…       dashboard, calendar, till, clients, team, insights, expenses, chair, book, visits
lib/chairbook/types.ts                  data model (plain JSON, Postgres-ready)
lib/chairbook/deals.ts                  settle(amount, rule) — the money math
lib/chairbook/selectors.ts              totals, settlement, weekday/hour profiles, client retention, expenses
lib/chairbook/seed.ts                   deterministic demo data (2 shops, 4 barbers, 8 weeks)
lib/chairbook/store.tsx                 React context + localStorage persistence
components/chairbook/                   UI kit, charts, SaleForm, BookingForm, Shell
```

**Demo mode.** There is no backend yet. Data is seeded on first load and kept
in the browser's `localStorage` (`chairbook.db`), so every change you make on
the demo persists on that device. "Reset demo data" on the login screen wipes
it. Logins are username + PIN checked client-side — fine for a demo, not for
production.

## What's simulated vs real

- **JCC terminal feed** is simulated. Real integration options: JCC's ECR
  (electronic cash register) protocol on the terminal, or a daily export from
  the JCC merchant portal, imported into the inbox. Either way the terminal
  only gives amount/time/card — matching to a client is still a one-tap step.
- **Auth & database**: the repo already has Supabase wired for the
  marketplace. Next step is a `chairbook` schema (shops, barbers, clients,
  services, appointments, sales, card_events) with row-level security so a
  barber only sees their own rows, and replacing the localStorage store with
  queries. The UI and the money math do not need to change.
- **Online booking for clients** works, but there are no SMS/WhatsApp
  reminders yet.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000/madbarbers
```
