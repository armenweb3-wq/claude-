/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Imagery is currently free Pexels stock served from their CDN. We keep
    // `unoptimized` so browsers load the URLs directly (the `?w=` query keeps
    // file sizes sensible). Once you've confirmed everything renders, set
    // `unoptimized: false` to get Vercel's automatic optimization — the
    // remotePatterns below already allow the Pexels host.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
