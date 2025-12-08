'use client';

import { SessionProvider } from 'next-auth/react';
import TVNavigation from './TVNavigation';
import ServiceWorkerRegister from './ServiceWorkerRegister';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <TVNavigation />
      {children}
    </SessionProvider>
  );
}
