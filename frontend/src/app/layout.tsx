import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'silentBTC - Native Stacks Intents',
  description: 'Signal shielded STX, sBTC, and USDCx swap intents on Stacks.',
  other: {
    'talentapp:project_verification':
      '6760658a558129232783b2f2a4826be9b8a81839a635c243f55bf343fc8030b27af305b848f3ebc528cc0f1024e6482f0ccbea4d822c988d2165ae15774754a5',
  },
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
