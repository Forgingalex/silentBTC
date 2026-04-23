import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'silentBTC - Native Stacks Intents',
  description: 'Signal shielded STX, sBTC, and USDCx swap intents on Stacks.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
