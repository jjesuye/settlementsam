/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit runs only in Node.js API routes — keep it server-side only
    serverComponentsExternalPackages: ['pdfkit', 'firebase-admin'],
  },
};

module.exports = nextConfig;
