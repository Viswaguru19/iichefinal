/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  serverExternalPackages: ['unpdf'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'html5-qrcode'],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
};

module.exports = nextConfig;
