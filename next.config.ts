import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The board shell lived at /admin until 2026-09-01. Old bookmarks and
      // links keep working; permanent, because the old name is not coming back.
      { source: "/admin", destination: "/board", permanent: true },
      { source: "/admin/:path*", destination: "/board/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
