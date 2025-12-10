"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function useServiceMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    let previousStatus = true;

    async function checkService() {
      try {
        const res = await fetch("/api/health", {
          method: "HEAD",
          cache: "no-store",
        });

        const currentStatus = res.ok;
        setIsOnline(currentStatus);
        setLastCheck(new Date());

        // Notificar mudanças de status
        if (previousStatus && !currentStatus) {
          toast.error("⚠️ Serviço offline detectado!", {
            duration: 10000,
            icon: "🔴",
          });
        } else if (!previousStatus && currentStatus) {
          toast.success("✅ Serviço voltou ao normal!", {
            duration: 5000,
            icon: "🟢",
          });
        }

        previousStatus = currentStatus;
      } catch {
        setIsOnline(false);
        setLastCheck(new Date());

        if (previousStatus) {
          toast.error("⚠️ Erro ao conectar com o serviço!", {
            duration: 10000,
            icon: "🔴",
          });
        }

        previousStatus = false;
      }
    }

    // Verificar a cada 60 segundos (economiza requests)
    checkService();
    const interval = setInterval(checkService, 60000);

    return () => clearInterval(interval);
  }, []);

  return { isOnline, lastCheck };
}
