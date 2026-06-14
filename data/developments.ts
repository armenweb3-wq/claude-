/**
 * Portfolio data — the single swap point for real assets.
 *
 * To use real photography/video: drop files into /public/assets/developments/
 * and update `image` (and optionally `video`) below. The cinematic Journey
 * renders these in array order and treats the entry flagged `flagship: true`
 * as the climax, so keep the flagship LAST.
 */

export type Development = {
  slug: string;
  name: string;
  location: string;
  status: "Now Selling" | "Under Construction" | "Completed" | "Coming Soon";
  year: string;
  tagline: string;
  description: string;
  /** Swap for a real photo: /assets/developments/your-photo.jpg */
  image: string;
  /** Optional background video for the Journey climax: /assets/developments/clip.mp4 */
  video?: string;
  stats: { label: string; value: string }[];
  flagship?: boolean;
};

export const developments: Development[] = [
  {
    slug: "azure-residences",
    name: "Azure Residences",
    location: "Kato Paphos",
    status: "Completed",
    year: "2021",
    tagline: "Where the harbour meets the horizon.",
    description:
      "Twenty-four sea-facing apartments steps from the ancient harbour, finished in pale travertine and oak with infinity-edge pools that dissolve into the Mediterranean.",
    image: "/assets/developments/azure-residences.svg",
    stats: [
      { label: "Residences", value: "24" },
      { label: "From", value: "€780k" },
      { label: "To sea", value: "200m" },
    ],
  },
  {
    slug: "olive-grove-villas",
    name: "Olive Grove Villas",
    location: "Tala Hills",
    status: "Completed",
    year: "2022",
    tagline: "Stone, shade and the scent of the grove.",
    description:
      "Nine private villas terraced into the Tala hillside among centuries-old olive trees, each with a heated pool and uninterrupted views down to Paphos and the sea beyond.",
    image: "/assets/developments/olive-grove-villas.svg",
    stats: [
      { label: "Villas", value: "9" },
      { label: "Plots from", value: "1,200m²" },
      { label: "From", value: "€1.4m" },
    ],
  },
  {
    slug: "coral-bay-collection",
    name: "Coral Bay Collection",
    location: "Coral Bay",
    status: "Under Construction",
    year: "2025",
    tagline: "A boutique address above the bay.",
    description:
      "An intimate collection of duplexes and penthouses a short walk from Coral Bay's golden sand, designed around a central courtyard garden and a rooftop residents' lounge.",
    image: "/assets/developments/coral-bay-collection.svg",
    stats: [
      { label: "Homes", value: "18" },
      { label: "Completion", value: "Q4 2025" },
      { label: "From", value: "€640k" },
    ],
  },
  {
    slug: "the-meridian",
    name: "The Meridian",
    location: "Paphos Seafront",
    status: "Now Selling",
    year: "2027",
    tagline: "The flagship. Our highest expression of coastal living.",
    description:
      "Rising along the Paphos seafront, The Meridian is our flagship — a sculptural landmark of full-floor residences, a private wellness level, concierge and a signature restaurant. The culmination of everything we build toward.",
    image: "/assets/developments/the-meridian.svg",
    video: undefined, // e.g. "/assets/developments/the-meridian.mp4"
    stats: [
      { label: "Floors", value: "22" },
      { label: "Residences", value: "40" },
      { label: "From", value: "€2.1m" },
    ],
    flagship: true,
  },
];
