// Shared TypeScript shapes that mirror the Supabase tables in
// supabase/schema.sql. Keep these in sync if you change the schema.

export type Role = "founder" | "investor" | "admin";

export type Profile = {
  id: string; // == auth.users.id
  full_name: string | null;
  role: Role;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Startup = {
  id: string;
  owner_id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  location: string | null;
  website: string | null;
  funding_goal: number | null; // amount the startup is raising (display only)
  published: boolean;
  created_at: string;
};

export type Investor = {
  id: string;
  owner_id: string;
  name: string; // person or firm name
  thesis: string | null;
  sectors: string[] | null;
  stages: string[] | null;
  check_min: number | null;
  check_max: number | null;
  location: string | null;
  website: string | null;
  published: boolean;
  created_at: string;
};

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type Connection = {
  id: string;
  from_id: string;
  to_id: string;
  message: string | null;
  status: ConnectionStatus;
  created_at: string;
};
