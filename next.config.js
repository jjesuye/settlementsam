/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Firebase Hosting App Router deployment
  output: 'standalone',
  experimental: {
    // pdfkit runs only in Node.js API routes — keep it server-side only
    serverComponentsExternalPackages: ['pdfkit', 'firebase-admin'],
  },
};

module.exports = nextConfig;
