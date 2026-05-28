import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Artifact Evolution · XO',
  description: 'One idea, five forms, one rail.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
