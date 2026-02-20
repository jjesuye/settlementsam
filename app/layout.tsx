import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'Settlement Sam — What Is Your Case Worth?',
  description: 'Get a free, instant estimate of your personal injury case value. No lawyers, no pressure. Just honest math from Sam.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title:       'Settlement Sam — Find Out What Your Case Is Worth',
    description: 'Instant personal injury case estimate. Free. No signup.',
    type:        'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
