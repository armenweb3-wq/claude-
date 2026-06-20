// Hustle Blends — content & configuration.
// Single edit point for shop details, services, the barber, hours and reviews.
// Mirrors the live hustleblends.cc (Hustle Blends × MadBarbers, Paphos, Cyprus).

export const currency = "€";

export const shop = {
  name: "Hustle Blends",
  tagline: "Fresh Fades in Paphos",
  blurb:
    "Hustle Blends × MadBarbers — Marios behind the chair in Paphos. One clean service done right: a fresh haircut and fade with the beard included. Book your next cut in seconds.",
  phone: "+357 96 606 880",
  phoneHref: "tel:+35796606880",
  instagram: "https://instagram.com/hustleblends",
  instagramHandle: "@hustleblends",
  address: {
    line1: "Hustle Blends × MadBarbers",
    line2: "Paphos, Cyprus",
  },
  // Used for the "Open in Maps" link and the embedded map.
  mapsQuery: "MadBarbers Paphos Cyprus",
  stats: [
    { value: "40 min", label: "Every cut" },
    { value: "€15", label: "All-in, beard incl." },
    { value: "4.9★", label: "Client rating" },
    { value: "5 days", label: "Open a week" },
  ],
  // Shown next to the booking flow.
  bookingNotes: [
    "Please arrive 5 minutes early.",
    "Late arrivals may shorten service time.",
    "Need to reschedule? Cancel and rebook anytime.",
  ],
} as const;

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  priceLabel?: string; // overrides the price (e.g. "Included")
  popular?: boolean;
};

// The shop runs a single all-in service; the beard trim is bundled.
export const services: Service[] = [
  {
    id: "haircut-fade",
    name: "Haircut & Fade",
    description:
      "A fresh haircut and clean skin or taper fade, with the beard trimmed, shaped and detailed — all included.",
    durationMin: 40,
    price: 15,
    popular: true,
  },
  {
    id: "beard-trim",
    name: "Beard Trim",
    description: "Shape, line-up and detail — included with every cut.",
    durationMin: 40,
    price: 0,
    priceLabel: "Included",
  },
];

// The bookable service (beard is bundled into it).
export const mainService = services[0];

export type Barber = {
  id: string;
  name: string;
  role: string;
  bio: string;
  specialties: string[];
  photo: string;
};

export const barber: Barber = {
  id: "marios",
  name: "Marios",
  role: "Master Barber · Hustle Blends × MadBarbers",
  bio: "Paphos-based barber with an eye for clean, sharp fades and detailed beard work. One chair, one standard — you leave looking your best, every visit.",
  specialties: ["Skin fades", "Tapers", "Beard detailing"],
  photo: "/barber/portrait-1.svg",
};

export type Hours = { day: string; open: string; close: string | null };

// Opening hours drive the booking time-slot generator. `close: null` = closed.
// Live shop: Mon–Wed & Fri–Sat 09:00–19:00, closed Thursday & Sunday.
export const hours: Hours[] = [
  { day: "Monday", open: "09:00", close: "19:00" },
  { day: "Tuesday", open: "09:00", close: "19:00" },
  { day: "Wednesday", open: "09:00", close: "19:00" },
  { day: "Thursday", open: "09:00", close: null },
  { day: "Friday", open: "09:00", close: "19:00" },
  { day: "Saturday", open: "09:00", close: "19:00" },
  { day: "Sunday", open: "09:00", close: null },
];

export type Review = {
  name: string;
  handle: string;
  text: string;
  rating: number;
};

export const reviews: Review[] = [
  {
    name: "Andreas K.",
    handle: "Haircut & Fade",
    rating: 5,
    text: "Best fade in Paphos, no question. Booking took ten seconds and Marios nailed exactly what I asked for.",
  },
  {
    name: "Yiannis P.",
    handle: "Haircut & Fade",
    rating: 5,
    text: "Sharp cut, clean beard line, and the whole thing was done in 40 minutes. Consistent every single time.",
  },
  {
    name: "Daniel R.",
    handle: "Haircut & Fade",
    rating: 5,
    text: "Walked in before a trip looking rough, walked out fresh. €15 all-in with the beard is unreal value.",
  },
  {
    name: "Marco S.",
    handle: "Haircut & Fade",
    rating: 5,
    text: "Found Hustle Blends on Instagram and now I won't go anywhere else. Proper barber, proper detail.",
  },
];
