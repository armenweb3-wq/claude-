// Central brand config for the marketplace. Rename the product, tweak the
// pitch, or change the contact email in ONE place — every page reads from here.
export const site = {
  name: "Catalyst",
  tagline: "Where startups meet the investors who back them.",
  description:
    "Catalyst is a curated marketplace connecting ambitious startups with investors. Founders showcase what they're building; investors discover their next opportunity. We make the introduction — you make the deal.",
  // Matchmaking platform — no money changes hands on the platform.
  url: "https://catalyst.example",
  supportEmail: "hello@catalyst.example",
} as const;

// The two kinds of accounts a visitor can register as. "admin" is assigned
// manually in the database (see supabase/schema.sql) and never self-selected.
export const sectors = [
  "AI / Machine Learning",
  "Fintech",
  "Health & Biotech",
  "Climate & Energy",
  "SaaS / Enterprise",
  "Consumer & Marketplace",
  "Hardware & Deep Tech",
  "Web3 & Crypto",
  "Other",
] as const;

export const stages = [
  "Idea / Pre-seed",
  "Seed",
  "Series A",
  "Series B+",
  "Growth",
] as const;

export type Sector = (typeof sectors)[number];
export type Stage = (typeof stages)[number];
