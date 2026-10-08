import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { SystemGuideChatbot } from '@/components/SystemGuideChatbot';

export const metadata: Metadata = {
  title: {
    default: 'Eduloft Student Accommodation',
    template: '%s | Eduloft',
  },
  description: 'Eduloft Centurion student accommodation application and administration portal.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
          <SystemGuideChatbot />
        </ToastProvider>
      </body>
    </html>
  );
}
