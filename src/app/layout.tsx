import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'lightweight-charts Next.js Wrapper',
  description:
    'Modular Next.js wrapper around lightweight-charts with drawing tools, custom indicators, replay mode and order markers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
