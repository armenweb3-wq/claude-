// Hustle Blends — content & configuration.
// This is the single edit point for shop details, services, barbers, hours
// and reviews. Update here and every section of the booking page follows.

export const shop = {
  name: "Hustle Blends",
  tagline: "Precision Cuts. Sharp Confidence.",
  blurb:
    "A modern barbershop where craft meets consistency. Walk in scruffy, walk out sharp — booked in under a minute.",
  phone: "(305) 555-0142",
  phoneHref: "tel:+13055550142",
  email: "book@hustleblends.cc",
  address: {
    line1: "248 Brickell Ave, Suite 5",
    line2: "Miami, FL 33131",
  },
  // Used for the "Get directions" link and the embedded map.
  mapsQuery: "248 Brickell Ave, Miami, FL 33131",
  social: {
    instagram: "https://instagram.com/hustleblends",
    tiktok: "https://tiktok.com/@hustleblends",
  },
  stats: [
    { value: "12k+", label: "Cuts delivered" },
    { value: "4.9★", label: "Average rating" },
    { value: "7", label: "Master barbers" },
    { value: "<60s", label: "To book a chair" },
  ],
} as const;

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  popular?: boolean;
};

export const services: Service[] = [
  {
    id: "signature-cut",
    name: "Signature Cut",
    description:
      "A consultation-led haircut tailored to your face and hair type, finished with a hot-towel and styling.",
    durationMin: 45,
    price: 45,
    popular: true,
  },
  {
    id: "skin-fade",
    name: "Skin Fade",
    description:
      "Razor-sharp gradient from skin to length, blended seamlessly with clipper-over-comb precision.",
    durationMin: 50,
    price: 50,
    popular: true,
  },
  {
    id: "cut-beard",
    name: "Cut & Beard Sculpt",
    description:
      "Full haircut paired with a hot-towel beard line-up, shaped and conditioned for a crisp finish.",
    durationMin: 60,
    price: 65,
  },
  {
    id: "beard-trim",
    name: "Beard & Line-up",
    description:
      "Detail trim, razor edge-up and beard oil — keep the shape sharp between full cuts.",
    durationMin: 30,
    price: 30,
  },
  {
    id: "hot-towel-shave",
    name: "Hot-Towel Shave",
    description:
      "Traditional straight-razor shave with warm towels, pre-shave oil and a cooling balm finish.",
    durationMin: 40,
    price: 40,
  },
  {
    id: "junior-cut",
    name: "Junior Cut (12 & under)",
    description:
      "A patient, kid-friendly cut that keeps the little ones still and sends them out looking fresh.",
    durationMin: 30,
    price: 28,
  },
];

export type Barber = {
  id: string;
  name: string;
  role: string;
  bio: string;
  specialties: string[];
  // Local placeholder portrait — swap for a real photo in /public/barber.
  photo: string;
};

export const barbers: Barber[] = [
  {
    id: "any",
    name: "First Available",
    role: "Fastest chair",
    bio: "Get booked with whichever master barber opens up first.",
    specialties: ["Shortest wait"],
    photo: "/barber/portrait-any.svg",
  },
  {
    id: "marcus",
    name: "Marcus Vale",
    role: "Master Barber · Owner",
    bio: "Fifteen years behind the chair. Lives for a flawless skin fade and a clean beard line.",
    specialties: ["Skin fades", "Beard sculpts"],
    photo: "/barber/portrait-1.svg",
  },
  {
    id: "deshawn",
    name: "DeShawn Pierce",
    role: "Senior Barber",
    bio: "Texture specialist — curls, waves and afros shaped with surgical precision.",
    specialties: ["Textured hair", "Tapers"],
    photo: "/barber/portrait-2.svg",
  },
  {
    id: "luca",
    name: "Luca Ferro",
    role: "Barber · Razor Work",
    bio: "Old-school straight-razor craftsman with a modern eye for clean classic cuts.",
    specialties: ["Hot-towel shaves", "Classic cuts"],
    photo: "/barber/portrait-3.svg",
  },
];

export type Hours = { day: string; open: string; close: string | null };

// Opening hours drive the booking time-slot generator. `close: null` = closed.
export const hours: Hours[] = [
  { day: "Monday", open: "10:00", close: "19:00" },
  { day: "Tuesday", open: "10:00", close: "19:00" },
  { day: "Wednesday", open: "10:00", close: "19:00" },
  { day: "Thursday", open: "10:00", close: "20:00" },
  { day: "Friday", open: "09:00", close: "20:00" },
  { day: "Saturday", open: "09:00", close: "18:00" },
  { day: "Sunday", open: "11:00", close: "16:00" },
];

export type Review = {
  name: string;
  handle: string;
  text: string;
  rating: number;
};

export const reviews: Review[] = [
  {
    name: "Andre M.",
    handle: "Signature Cut",
    rating: 5,
    text: "Best fade in Brickell, hands down. Booking took ten seconds and Marcus nailed it exactly how I asked.",
  },
  {
    name: "Tobias R.",
    handle: "Cut & Beard Sculpt",
    rating: 5,
    text: "Walked in for a wedding cut and left looking like a different man. The hot-towel finish is unreal.",
  },
  {
    name: "Chris D.",
    handle: "Hot-Towel Shave",
    rating: 5,
    text: "Luca's straight-razor shave is the most relaxing 40 minutes of my month. Properly old-school.",
  },
  {
    name: "Marcus T.",
    handle: "Skin Fade",
    rating: 5,
    text: "Consistent every single visit. That's the part most shops miss — these guys never miss.",
  },
];
