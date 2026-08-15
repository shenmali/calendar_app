import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { appName } from '@/lib/app-config';
import './globals.css';

export const metadata: Metadata = {
  title: appName,
  description: 'Kişisel takvim uygulaması',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
