"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ruleFor, settle } from "./deals";
import { buildSeed, DB_VERSION } from "./seed";
import type {
  ClientType,
  Sale,
  Appointment,
  ApptStatus,
  Barber,
  Client,
  DB,
  Deal,
  Expense,
  PayMethod,
  Role,
  SaleSource,
  Session,
  Shop,
  User,
} from "./types";

const DB_KEY = "chairbook.db";
const SESSION_KEY = "chairbook.session";

export interface NewSaleInput {
  shopId: string;
  barberId: string;
  clientId: string | null;
  serviceId: string;
  amount: number;
  method: PayMethod;
  source: SaleSource;
  cardEventId?: string;
  appointmentId?: string;
  at?: string;
}

export interface NewAppointmentInput {
  shopId: string;
  barberId: string;
  clientId: string | null;
  clientName?: string;
  serviceId: string;
  startsAt: string;
  bookedBy: Role;
}

interface Store {
  ready: boolean;
  db: DB;
  session: Session | null;
  user: User | null;
  role: Role | null;
  /** The barber record when the signed-in user is a barber. */
  me: Barber | null;
  /** The client record when the signed-in user is a client. */
  meClient: Client | null;
  login: (username: string, pin: string) => string | null;
  logout: () => void;
  resetDemo: () => void;
  addSale: (input: NewSaleInput) => string;
  addAppointment: (input: NewAppointmentInput) => string;
  setAppointmentStatus: (id: string, status: ApptStatus) => void;
  addClient: (c: Omit<Client, "id" | "createdAt">) => string;
  assignClient: (clientId: string, ownerBarberId: string | null) => void;
  updateDeal: (barberId: string, deal: Deal) => void;
  addBarber: (b: Omit<Barber, "id">, username: string, pin: string) => void;
  addShop: (s: Omit<Shop, "id">) => void;
  ignoreCardEvent: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = buildSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  } catch {
    /* storage may be unavailable */
  }
  return fresh;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function ChairbookProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setDb(loadDb());
    setSession(loadSession());
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }, [db]);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, [session]);

  const update = useCallback((fn: (d: DB) => DB) => {
    setDb((d) => (d ? fn(d) : d));
  }, []);

  const value = useMemo<Store>(() => {
    const data = db ?? emptyDb();
    const user = session ? data.users.find((u) => u.id === session.userId) ?? null : null;
    const me = user?.barberId ? data.barbers.find((b) => b.id === user.barberId) ?? null : null;
    const meClient = user?.clientId
      ? data.clients.find((c) => c.id === user.clientId) ?? null
      : null;

    return {
      ready: db !== null,
      db: data,
      session,
      user,
      role: user?.role ?? null,
      me,
      meClient,
      login(username, pin) {
        const u = data.users.find(
          (x) => x.username.toLowerCase() === username.trim().toLowerCase(),
        );
        if (!u) return "No account with that username.";
        if (u.pin !== pin) return "Wrong PIN.";
        setSession({ userId: u.id });
        return null;
      },
      logout() {
        setSession(null);
      },
      resetDemo() {
        const fresh = buildSeed();
        setDb(fresh);
        setSession(null);
      },
      addSale(input) {
        const id = uid("sl");
        update((d) => {
          const barber = d.barbers.find((b) => b.id === input.barberId);
          if (!barber) return d;
          const client = input.clientId ? d.clients.find((c) => c.id === input.clientId) : null;
          const clientType: ClientType = client && client.ownerBarberId === barber.id ? "own" : "walkin";
          const split = settle(input.amount, ruleFor(barber.deal, clientType));
          const sale: Sale = {
            id,
            shopId: input.shopId,
            barberId: input.barberId,
            clientId: input.clientId,
            clientType,
            source: input.source,
            serviceId: input.serviceId,
            amount: input.amount,
            method: input.method,
            cardEventId: input.cardEventId,
            appointmentId: input.appointmentId,
            at: input.at ?? new Date().toISOString(),
            shopShare: split.shop,
            barberShare: split.barber,
          };
          return {
            ...d,
            sales: [...d.sales, sale],
            cardEvents: d.cardEvents.map((e) =>
              e.id === input.cardEventId ? { ...e, status: "matched" as const, saleId: id } : e,
            ),
            appointments: d.appointments.map((a) =>
              a.id === input.appointmentId ? { ...a, status: "done" as const, saleId: id } : a,
            ),
          };
        });
        return id;
      },
      addAppointment(input) {
        const id = uid("a");
        update((d) => {
          const service = d.services.find((s) => s.id === input.serviceId);
          const appt: Appointment = {
            id,
            shopId: input.shopId,
            barberId: input.barberId,
            clientId: input.clientId,
            clientName: input.clientName,
            serviceId: input.serviceId,
            startsAt: input.startsAt,
            minutes: service?.minutes ?? 30,
            status: "booked",
            bookedBy: input.bookedBy,
          };
          return {
            ...d,
            appointments: [...d.appointments, appt].sort((a, b) =>
              a.startsAt.localeCompare(b.startsAt),
            ),
          };
        });
        return id;
      },
      setAppointmentStatus(id, status) {
        update((d) => ({
          ...d,
          appointments: d.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
        }));
      },
      addClient(c) {
        const id = uid("c");
        update((d) => ({
          ...d,
          clients: [...d.clients, { ...c, id, createdAt: new Date().toISOString() }],
        }));
        return id;
      },
      assignClient(clientId, ownerBarberId) {
        update((d) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === clientId ? { ...c, ownerBarberId } : c)),
        }));
      },
      updateDeal(barberId, deal) {
        update((d) => ({
          ...d,
          barbers: d.barbers.map((b) => (b.id === barberId ? { ...b, deal } : b)),
        }));
      },
      addBarber(b, username, pin) {
        const id = uid("b");
        update((d) => ({
          ...d,
          barbers: [...d.barbers, { ...b, id }],
          users: [
            ...d.users,
            { id: uid("u"), username, pin, name: b.name, role: "barber", barberId: id },
          ],
        }));
      },
      addShop(s) {
        update((d) => ({ ...d, shops: [...d.shops, { ...s, id: uid("s") }] }));
      },
      ignoreCardEvent(id) {
        update((d) => ({ ...d, cardEvents: d.cardEvents.filter((e) => e.id !== id) }));
      },
      addExpense(e) {
        update((d) => ({
          ...d,
          expenses: [...d.expenses, { ...e, id: uid("ex") }].sort((a, b) => a.at.localeCompare(b.at)),
        }));
      },
      deleteExpense(id) {
        update((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
      },
    };
  }, [db, session, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function emptyDb(): DB {
  return {
    version: DB_VERSION,
    seededAt: "",
    shops: [],
    users: [],
    barbers: [],
    clients: [],
    services: [],
    sales: [],
    appointments: [],
    cardEvents: [],
    expenses: [],
  };
}

export function useChairbook() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChairbook must be used inside ChairbookProvider");
  return ctx;
}
