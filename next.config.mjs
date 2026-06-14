/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // The starter ships labeled SVG placeholders. The Next image optimizer
    // rejects SVGs by default, so we serve images unoptimized for now. When you
    // swap in real .jpg/.webp photos, set this back to false (and optionally add
    // remotePatterns) to get automatic optimization again.
    unoptimized: true,
  },
};

export default nextConfig;
