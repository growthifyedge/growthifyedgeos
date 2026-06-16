/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are stable in Next 15; kept here for clarity of intent.
  },
  images: {
    remotePatterns: [
      // Allow Supabase Storage public/signed URLs for avatars & task files.
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
