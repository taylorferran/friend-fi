import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile Privy packages
  transpilePackages: [
    '@privy-io/react-auth',
  ],
  
  // Empty turbopack config to use defaults
  turbopack: {},
  
  // Image domains for avatars
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
};

export default nextConfig;
