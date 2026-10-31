# Chairbook — barbershop ledger & bookings (MVP)

Served at **`/chairbook`**. A self-contained section of this Next.js app for
running multi-location barbershops: bookings, a till that records every cut as
cash or card, per-barber deals, end-of-day settlement, and walk-in insights.

## What it does today

| Role | Login | What they see |
|------|-------|---------------|
| Owner | `owner` / `1234` | Dashboard (gross, shop net, barber payouts, cash vs card, per-barber settlement), Calendar for every barber, Till + JCC inbox, Clients, Team & deals, Insights, shop switcher |
| Barber | `andreas`, `kyriakos`, `marios`, `stelios` / `1111` | Their day, Till (their payments), their clients, Earnings + settlement with the shop |
| Client | `nikos` / `0000` | Book an appointment, upcoming & past visits |

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

**Insights.** Average booked vs walk-in visits per weekday (last 8 weeks),
visits by hour, cash/card split, shop comparison, and a booking-policy
suggestion: weekdays with ≥40% walk-in share are flagged "keep slots open".

## How it's built

```
app/(chairbook)/layout.tsx              third root layout (own <html>/<body>)
app/(chairbook)/chairbook/page.tsx      login
app/(chairbook)/chairbook/(app)/…       dashboard, calendar, till, clients, team, insights, earnings, book, visits
lib/chairbook/types.ts                  data model (plain JSON, Postgres-ready)
lib/chairbook/deals.ts                  settle(amount, rule) — the money math
lib/chairbook/selectors.ts              totals, settlement, weekday/hour profiles
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
npm run dev     # http://localhost:3000/chairbook
```
