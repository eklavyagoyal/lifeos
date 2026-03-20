import type { Metadata } from 'next';
import './globals.css';
import { PwaProvider } from '@/components/pwa/pwa-provider';
import { ModeProvider } from '@/stores/mode-store';

export const metadata: Metadata = {
  title: 'lifeOS',
  description: 'Your personal Life Operating System',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ModeProvider>
          <PwaProvider />
          {children}
        </ModeProvider>
      </body>
    </html>
  );
}
