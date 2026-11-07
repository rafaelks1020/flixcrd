"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseAdminDataOptions<T> {
  endpoint: string;
  initialData?: T | null;
  transform?: (data: any) => T;
}

interface UseAdminDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useAdminData<T = any>({
  endpoint,
  initialData = null,
  transform,
}: UseAdminDataOptions<T>): UseAdminDataReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const resp = await fetch(endpoint, { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`Falha ao carregar dados (${resp.status})`);
        }
        const json = await resp.json();

        if (!cancelled) {
          const transformed = transformRef.current ? transformRef.current(json) : json;
          setData(transformed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, refreshKey]);

  const reload = useCallback(async () => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { data, loading, error, reload };
}

export function useAdminList<T = any>(
  endpoint: string,
  itemsKey: string,
  initialData: T[] = []
) {
  return useAdminData<T[]>({
    endpoint,
    initialData,
    transform: (json) => {
      const items = json?.[itemsKey];
      return Array.isArray(items) ? items : [];
    },
  });
}
