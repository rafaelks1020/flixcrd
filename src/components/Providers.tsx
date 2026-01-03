'use client';

import { SessionProvider } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import TVNavigation from './TVNavigation';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import Toast from './ui/Toast';
import PresenceHeartbeat from './PresenceHeartbeat';

import { SettingsProvider } from "@/context/SettingsContext";

interface ProvidersProps {
  children: React.ReactNode;
  settings: any;
}

export default function Providers({ children, settings }: ProvidersProps) {
  const pathname = usePathname();
  const showToast = !pathname.startsWith('/admin');

  return (
    <SessionProvider>
      <SettingsProvider settings={settings}>
        {showToast ? <Toast /> : null}
        <PresenceHeartbeat />
        <ServiceWorkerRegister />
        <TVNavigation />
        {children}
      </SettingsProvider>
    </SessionProvider>
  );
}
