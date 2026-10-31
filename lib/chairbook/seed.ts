import { ruleFor, settle } from "./deals";
import { addDays, startOfDay } from "./format";
import type {
  Appointment,
  Barber,
  CardEvent,
  Client,
  DB,
  PayMethod,
  Sale,
  Service,
  Shop,
  User,
} from "./types";

export const DB_VERSION = 1;

// Deterministic PRNG so the demo looks the same on every reset.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SHOPS: Shop[] = [
  {
    id: "s1",
    name: "Makariou",
    area: "Makariou Avenue",
    terminalId: "JCC-4471",
    openHour: 9,
    closeHour: 19,
    closedDays: [0],
  },
  {
    id: "s2",
    name: "Harbour",
    area: "Old Harbour",
    terminalId: "JCC-4472",
    openHour: 9,
    closeHour: 19,
    closedDays: [0],
  },
];

export const SERVICES: Service[] = [
  { id: "cut", name: "Haircut", price: 20, minutes: 30 },
  { id: "fade", name: "Skin fade", price: 25, minutes: 40 },
  { id: "beard", name: "Beard trim", price: 10, minutes: 20 },
  { id: "cutbeard", name: "Haircut + beard", price: 30, minutes: 45 },
  { id: "kids", name: "Kids cut", price: 15, minutes: 25 },
  { id: "cutbeardwash", name: "Cut + beard + wash", price: 40, minutes: 60 },
  { id: "grooming", name: "Full grooming", price: 50, minutes: 75 },
];

const BARBERS: Barber[] = [
  {
    id: "b1",
    name: "Andreas",
    shopId: "s1",
    color: "#2563eb",
    active: true,
    deal: {
      ownClients: { kind: "flat", shopTakes: 5 },
      walkIns: { kind: "percent", shopPct: 50 },
    },
  },
  {
    id: "b2",
    name: "Kyriakos",
    shopId: "s1",
    color: "#7c3aed",
    active: true,
    deal: {
      ownClients: { kind: "flat", shopTakes: 5 },
      walkIns: { kind: "percent", shopPct: 40 },
    },
  },
  {
    id: "b3",
    name: "Marios",
    shopId: "s2",
    color: "#0d9488",
    active: true,
    deal: {
      ownClients: { kind: "percent", shopPct: 30 },
      walkIns: { kind: "percent", shopPct: 50 },
    },
  },
  {
    id: "b4",
    name: "Stelios",
    shopId: "s2",
    color: "#ea580c",
    active: true,
    deal: {
      ownClients: { kind: "flat", shopTakes: 5 },
      walkIns: { kind: "percent", shopPct: 60 },
    },
  },
];

const USERS: User[] = [
  { id: "u-owner", username: "owner", pin: "1234", name: "Owner", role: "owner" },
  { id: "u-b1", username: "andreas", pin: "1111", name: "Andreas", role: "barber", barberId: "b1" },
  { id: "u-b2", username: "kyriakos", pin: "1111", name: "Kyriakos", role: "barber", barberId: "b2" },
  { id: "u-b3", username: "marios", pin: "1111", name: "Marios", role: "barber", barberId: "b3" },
  { id: "u-b4", username: "stelios", pin: "1111", name: "Stelios", role: "barber", barberId: "b4" },
  { id: "u-c1", username: "nikos", pin: "0000", name: "Nikos Charalambous", role: "client", clientId: "c-b1-0" },
];

const FIRST = [
  "Nikos", "Giorgos", "Christos", "Panayiotis", "Michalis", "Savvas", "Costas",
  "Antonis", "Demetris", "Yiannis", "Charalambos", "Loizos", "Petros", "Stavros",
  "Marinos", "Sotiris", "Elias", "Alexandros", "Daniel", "Tom", "Sergei",
  "Dmitry", "Ahmed", "Omar", "Rafael", "Lucas", "Marco", "Andrei", "Pavlos", "Kyprianos",
];
const LAST = [
  "Charalambous", "Ioannou", "Georgiou", "Constantinou", "Christodoulou",
  "Papadopoulos", "Nicolaou", "Michael", "Petrou", "Andreou", "Kyriakou",
  "Stylianou", "Antoniou", "Hadjiyiannis", "Economou", "Novak", "Smirnov",
  "Hassan", "Rossi", "Silva",
];

function makeClients(rand: () => number, now: Date): Client[] {
  const clients: Client[] = [];
  let n = 0;
  const name = () =>
    `${FIRST[n++ % FIRST.length]} ${LAST[Math.floor(rand() * LAST.length)]}`;
  const phone = () => `99 ${Math.floor(100000 + rand() * 899999)}`;
  for (const b of BARBERS) {
    for (let i = 0; i < 12; i++) {
      clients.push({
        id: `c-${b.id}-${i}`,
        name: name(),
        phone: phone(),
        shopId: b.shopId,
        ownerBarberId: b.id,
        createdAt: addDays(now, -Math.floor(30 + rand() * 300)).toISOString(),
      });
    }
  }
  for (const s of SHOPS) {
    for (let i = 0; i < 8; i++) {
      clients.push({
        id: `c-${s.id}-shop-${i}`,
        name: name(),
        phone: phone(),
        shopId: s.id,
        ownerBarberId: null,
        createdAt: addDays(now, -Math.floor(10 + rand() * 200)).toISOString(),
      });
    }
  }
  // Give the demo client login a stable, recognisable name.
  const demo = clients.find((c) => c.id === "c-b1-0");
  if (demo) demo.name = "Nikos Charalambous";
  return clients;
}

// Average visits per barber per weekday (index 0 = Sunday). The pattern the
// owner wants to see: walk-ins pile up on Friday/Saturday, bookings are
// spread through the week.
const BOOKED_BY_DAY = [0, 4, 5, 4, 5, 5, 4];
const WALKIN_BY_DAY = [0, 1, 1, 2, 2, 5, 8];

const OWN_PRICES = [17, 18, 20, 20, 20];

export function buildSeed(now = new Date()): DB {
  const rand = mulberry32(20261031);
  const clients = makeClients(rand, now);
  const sales: Sale[] = [];
  const appointments: Appointment[] = [];
  const cardEvents: CardEvent[] = [];
  let id = 1;
  const nextId = (p: string) => `${p}${(id++).toString(36)}`;

  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // So the demo is never empty when opened early in the morning.
  const todayCutoff = Math.max(nowMinutes, 13 * 60 + 30);

  const today = startOfDay(now);
  for (let back = 56; back >= 0; back--) {
    const day = addDays(today, -back);
    const dow = day.getDay();
    for (const barber of BARBERS) {
      const shop = SHOPS.find((s) => s.id === barber.shopId)!;
      if (shop.closedDays.includes(dow)) continue;
      const own = clients.filter((c) => c.ownerBarberId === barber.id);
      const shopClients = clients.filter(
        (c) => c.shopId === shop.id && c.ownerBarberId === null,
      );
      const nBooked = Math.max(0, Math.round(BOOKED_BY_DAY[dow] + (rand() - 0.5) * 3));
      const nWalk = Math.max(0, Math.round(WALKIN_BY_DAY[dow] * (0.6 + rand() * 0.8)));
      const slots = (shop.closeHour - shop.openHour) * 2;
      const used = new Set<number>();
      const takeSlot = () => {
        for (let tries = 0; tries < 30; tries++) {
          const s = Math.floor(rand() * slots);
          if (!used.has(s)) {
            used.add(s);
            return s;
          }
        }
        return null;
      };

      const visits: { slot: number; booked: boolean }[] = [];
      for (let i = 0; i < nBooked; i++) {
        const s = takeSlot();
        if (s !== null) visits.push({ slot: s, booked: true });
      }
      for (let i = 0; i < nWalk; i++) {
        const s = takeSlot();
        if (s !== null) visits.push({ slot: s, booked: false });
      }
      visits.sort((a, b) => a.slot - b.slot);

      for (const v of visits) {
        const minutes = shop.openHour * 60 + v.slot * 30;
        const at = new Date(day);
        at.setMinutes(minutes);
        const isToday = back === 0;
        const future = isToday && minutes > todayCutoff;

        // Who is it? Booked visits are mostly the barber's own clients; walk-ins
        // are mostly unknown people or shop clients.
        let client: Client | null;
        if (v.booked) client = rand() < 0.8 ? pick(own) : pick(shopClients);
        else client = rand() < 0.55 ? null : rand() < 0.3 ? pick(own) : pick(shopClients);
        const clientType = client && client.ownerBarberId === barber.id ? "own" : "walkin";

        const service =
          clientType === "own"
            ? pick([SERVICES[0], SERVICES[0], SERVICES[3], SERVICES[1], SERVICES[2]])
            : pick([SERVICES[0], SERVICES[1], SERVICES[3], SERVICES[2], SERVICES[4], SERVICES[5], SERVICES[6]]);
        const amount =
          clientType === "own" && service.id === "cut" ? pick(OWN_PRICES) : service.price;

        if (v.booked) {
          const appt: Appointment = {
            id: nextId("a"),
            shopId: shop.id,
            barberId: barber.id,
            clientId: client?.id ?? null,
            serviceId: service.id,
            startsAt: at.toISOString(),
            minutes: service.minutes,
            status: future ? "booked" : "done",
            bookedBy: rand() < 0.5 ? "client" : "owner",
          };
          appointments.push(appt);
          if (future) continue;
          const sale = makeSale(barber, shop, client, clientType, service, amount, at, "booked", rand);
          sale.appointmentId = appt.id;
          appt.saleId = sale.id;
          sales.push(sale);
          if (sale.method === "card") cardEvents.push(cardEventFor(sale, shop, rand, nextId));
        } else {
          if (future) continue;
          const sale = makeSale(barber, shop, client, clientType, service, amount, at, "walk-in", rand);
          sales.push(sale);
          if (sale.method === "card") cardEvents.push(cardEventFor(sale, shop, rand, nextId));
        }
      }
    }
  }

  // Upcoming bookings for the next 6 days.
  for (let ahead = 1; ahead <= 6; ahead++) {
    const day = addDays(today, ahead);
    const dow = day.getDay();
    for (const barber of BARBERS) {
      const shop = SHOPS.find((s) => s.id === barber.shopId)!;
      if (shop.closedDays.includes(dow)) continue;
      const own = clients.filter((c) => c.ownerBarberId === barber.id);
      const n = Math.max(1, Math.round(BOOKED_BY_DAY[dow] * (0.4 + rand() * 0.6)));
      const used = new Set<number>();
      for (let i = 0; i < n; i++) {
        const slot = Math.floor(rand() * (shop.closeHour - shop.openHour) * 2);
        if (used.has(slot)) continue;
        used.add(slot);
        const at = new Date(day);
        at.setMinutes(shop.openHour * 60 + slot * 30);
        const service = pick([SERVICES[0], SERVICES[0], SERVICES[3], SERVICES[1]]);
        appointments.push({
          id: nextId("a"),
          shopId: shop.id,
          barberId: barber.id,
          clientId: pick(own).id,
          serviceId: service.id,
          startsAt: at.toISOString(),
          minutes: service.minutes,
          status: "booked",
          bookedBy: rand() < 0.5 ? "client" : "owner",
        });
      }
    }
  }

  // A few card payments the terminal reported that nobody has assigned yet.
  const unmatched: [string, number, number][] = [
    ["s1", 25, 35],
    ["s1", 30, 70],
    ["s2", 20, 20],
  ];
  for (const [shopId, amount, minsAgo] of unmatched) {
    const shop = SHOPS.find((s) => s.id === shopId)!;
    const at = new Date(now.getTime() - minsAgo * 60_000);
    cardEvents.push({
      id: nextId("ce"),
      shopId,
      terminalId: shop.terminalId,
      amount,
      at: at.toISOString(),
      last4: String(1000 + Math.floor(rand() * 9000)),
      status: "unmatched",
    });
  }

  sales.sort((a, b) => a.at.localeCompare(b.at));
  appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  cardEvents.sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    shops: SHOPS,
    users: USERS,
    barbers: BARBERS,
    clients,
    services: SERVICES,
    sales,
    appointments,
    cardEvents,
  };
}

function makeSale(
  barber: Barber,
  shop: Shop,
  client: Client | null,
  clientType: "own" | "walkin",
  service: Service,
  amount: number,
  at: Date,
  source: "booked" | "walk-in",
  rand: () => number,
): Sale {
  const method: PayMethod = rand() < 0.55 ? "cash" : "card";
  const split = settle(amount, ruleFor(barber.deal, clientType));
  return {
    id: `sl-${at.getTime().toString(36)}-${barber.id}`,
    shopId: shop.id,
    barberId: barber.id,
    clientId: client?.id ?? null,
    clientType,
    source,
    serviceId: service.id,
    amount,
    method,
    at: at.toISOString(),
    shopShare: split.shop,
    barberShare: split.barber,
  };
}

function cardEventFor(
  sale: Sale,
  shop: Shop,
  rand: () => number,
  nextId: (p: string) => string,
): CardEvent {
  const id = nextId("ce");
  sale.cardEventId = id;
  return {
    id,
    shopId: shop.id,
    terminalId: shop.terminalId,
    amount: sale.amount,
    at: new Date(new Date(sale.at).getTime() + 25 * 60_000).toISOString(),
    last4: String(1000 + Math.floor(rand() * 9000)),
    status: "matched",
    saleId: sale.id,
  };
}
