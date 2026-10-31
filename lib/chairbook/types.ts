// Mad Barbers — data model for the barbershop ledger MVP.
// Everything here is plain JSON so it can live in localStorage today and in
// Postgres (Supabase) tomorrow without changing the UI.

export type Role = "owner" | "barber" | "client";

export interface Shop {
  id: string;
  name: string;
  area: string;
  /** JCC terminal ID attached to this shop's card machine. */
  terminalId: string;
  openHour: number; // 24h, inclusive
  closeHour: number; // 24h, exclusive
  /** 0 = Sunday … 6 = Saturday */
  closedDays: number[];
}

/**
 * A deal rule is how one cut is split between the shop and the barber.
 * - flat:    the shop takes a fixed amount (e.g. €5), the barber keeps the rest
 * - percent: the shop takes a percentage (e.g. 50%), the barber keeps the rest
 */
export type DealRule =
  | { kind: "flat"; shopTakes: number }
  | { kind: "percent"; shopPct: number };

/** Each barber has two rules: one for clients they bring, one for walk-ins. */
export interface Deal {
  ownClients: DealRule;
  walkIns: DealRule;
}

export interface User {
  id: string;
  username: string;
  pin: string;
  name: string;
  role: Role;
  barberId?: string;
  clientId?: string;
}

export interface Barber {
  id: string;
  name: string;
  shopId: string;
  deal: Deal;
  /** Tailwind-friendly hex used for calendar columns and charts. */
  color: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  shopId: string;
  /** null = shop (walk-in) client; otherwise the barber who brought them. */
  ownerBarberId: string | null;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  minutes: number;
}

export type ClientType = "own" | "walkin";
export type PayMethod = "cash" | "card";
export type SaleSource = "booked" | "walk-in";

/**
 * One row in the ledger. Shares are snapshotted at the time of sale so that
 * changing a barber's deal later never rewrites history.
 */
export interface Sale {
  id: string;
  shopId: string;
  barberId: string;
  clientId: string | null;
  clientType: ClientType;
  source: SaleSource;
  serviceId: string;
  amount: number;
  method: PayMethod;
  /** Tip on top of `amount`. Goes 100% to the barber. */
  tip?: number;
  /** Set when a card payment was matched to a JCC terminal event. */
  cardEventId?: string;
  at: string; // ISO datetime
  shopShare: number;
  barberShare: number;
  appointmentId?: string;
  note?: string;
}

export type ApptStatus = "booked" | "done" | "cancelled" | "no-show";

export interface Appointment {
  id: string;
  shopId: string;
  barberId: string;
  clientId: string | null;
  /** Free-text name for someone not in the client list yet. */
  clientName?: string;
  serviceId: string;
  startsAt: string; // ISO datetime
  minutes: number;
  status: ApptStatus;
  bookedBy: Role;
  createdAt: string;
  saleId?: string;
}

/** A card payment reported by the JCC terminal. Unmatched until assigned. */
export interface CardEvent {
  id: string;
  shopId: string;
  terminalId: string;
  amount: number;
  at: string;
  last4: string;
  status: "unmatched" | "matched";
  saleId?: string;
}

export type ExpenseCategory =
  | "rent"
  | "utilities"
  | "supplies"
  | "products"
  | "tools"
  | "marketing"
  | "transport"
  | "other";

/** Money going out. Shop expenses have no barberId; a barber's own expenses do. */
export interface Expense {
  id: string;
  shopId: string;
  barberId: string | null;
  category: ExpenseCategory;
  amount: number;
  note: string;
  at: string; // ISO date
}

export interface DB {
  version: number;
  seededAt: string;
  shops: Shop[];
  users: User[];
  barbers: Barber[];
  clients: Client[];
  services: Service[];
  sales: Sale[];
  appointments: Appointment[];
  cardEvents: CardEvent[];
  expenses: Expense[];
}

export interface Session {
  userId: string;
}
