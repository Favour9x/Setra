import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Circle SDK from client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/dashboard",
        destination: "/",
      },
      {
        source: "/dashboard/send",
        destination: "/send",
      },
      {
        source: "/dashboard/invoices",
        destination: "/invoices",
      },
      {
        source: "/dashboard/invoices/new",
        destination: "/invoices?new=true",
      },
      {
        source: "/dashboard/tips",
        destination: "/tips",
      },
      {
        source: "/dashboard/settings",
        destination: "/settings",
      },
    ];
  },
};

export default nextConfig;
