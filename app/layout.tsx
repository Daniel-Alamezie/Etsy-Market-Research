import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Etsy Niche Research',
  description:
    'Analyze public Etsy listing data — prices, tags, favorites, and dates — to gauge pricing and competition across print niches.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
