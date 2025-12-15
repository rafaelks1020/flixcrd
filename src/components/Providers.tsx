'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import TVNavigation from './TVNavigation';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import Toast from './ui/Toast';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const showToast = !pathname.startsWith('/admin');

  return (
    <SessionProvider>
      {showToast ? <Toast /> : null}
      <ServiceWorkerRegister />
      <TVNavigation />
      {children}
    </SessionProvider>
  );
}
