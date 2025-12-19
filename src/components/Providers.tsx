'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import TVNavigation from './TVNavigation';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import Toast from './ui/Toast';
import PresenceHeartbeat from './PresenceHeartbeat';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const showToast = !pathname.startsWith('/admin');

  return (
    <SessionProvider>
      {showToast ? <Toast /> : null}
      <PresenceHeartbeat />
      <ServiceWorkerRegister />
      <TVNavigation />
      {children}
    </SessionProvider>
  );
}
