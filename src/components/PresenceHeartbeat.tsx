'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';
  try {
    const k = 'presence_device_id_v1';
    const existing = window.localStorage.getItem(k);
    if (existing) return existing;
    let next = '';
    try {
      next = crypto.randomUUID();
    } catch {
      next = '';
    }
    if (!next) next = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    window.localStorage.setItem(k, next);
    return next;
  } catch {
    return '';
  }
}

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return '';
  try {
    const k = 'presence_session_id_v1';
    const existing = window.sessionStorage.getItem(k);
    if (existing) return existing;
    let next = '';
    try {
      next = crypto.randomUUID();
    } catch {
      next = '';
    }
    if (!next) next = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    window.sessionStorage.setItem(k, next);
    return next;
  } catch {
    return '';
  }
}

export default function PresenceHeartbeat() {
  const pathname = usePathname();
  const disabled = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/admin')) return true;
    return false;
  }, [pathname]);

  const sessionIdRef = useRef<string>('');
  const deviceIdRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  async function sendHeartbeat({ end }: { end: boolean }) {
    if (disabled) return;
    if (typeof window === 'undefined') return;

    const sessionId = sessionIdRef.current || getOrCreateSessionId();
    const deviceId = deviceIdRef.current || getOrCreateDeviceId();
    sessionIdRef.current = sessionId;
    deviceIdRef.current = deviceId;

    if (!sessionId) return;

    const payload = JSON.stringify({
      sessionId,
      deviceId,
      platform: 'web',
    });

    const url = end ? '/api/presence/heartbeat?end=1' : '/api/presence/heartbeat';

    try {
      if (end && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      }
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        cache: 'no-store',
      });
    } catch {
    }
  }

  useEffect(() => {
    if (disabled) return;

    sessionIdRef.current = getOrCreateSessionId();
    deviceIdRef.current = getOrCreateDeviceId();

    void sendHeartbeat({ end: false });

    const intervalMs = 25_000;
    timerRef.current = window.setInterval(() => {
      void sendHeartbeat({ end: false });
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat({ end: false });
      }
    };

    const onBeforeUnload = () => {
      void sendHeartbeat({ end: true });
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      void sendHeartbeat({ end: true });
    };
  }, [disabled]);

  return null;
}
