import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
// Headings only: page titles and the sign-in panel.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['500', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'Brightloop', template: '%s · Brightloop' },
  description: 'Plans, subscriptions and recurring billing in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors closeButton position="top-right" toastOptions={{ className: 'font-sans' }} />
      </body>
    </html>
  );
}
