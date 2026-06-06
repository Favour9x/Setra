"use client";

import useSWR from "swr";
import type { SWRConfiguration } from "swr";

const CACHE_PREFIX = "setra_cache_";
const CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export function getCachedData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem(getCacheKey(key));
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T, ttl = CACHE_TTL): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getCacheKey(key),
      JSON.stringify({ data, expiry: Date.now() + ttl })
    );
  } catch {}
}

const jsonFetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
};

const postFetcher = async ([url, body]: [string, any]) => {
  const res = await fetch(url, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
};

const swrDefaults: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 2,
};

export function useApiData<T = any>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: SWRConfiguration
) {
  return useSWR<T>(key, fetcher, {
    ...swrDefaults,
    ...options,
    fallbackData: key ? getCachedData<T>(key) ?? options?.fallbackData : undefined,
    onSuccess: (data: T) => {
      if (key) setCachedData(key, data);
    },
  });
}

export function useJsonFetch<T = any>(
  url: string | null,
  options?: SWRConfiguration
) {
  return useApiData<T>(
    url ? `json:${url}` : null,
    () => jsonFetcher(url!).then((d) => d as T),
    options
  );
}

export function usePostFetch<T = any>(
  url: string,
  body: any,
  options?: SWRConfiguration
) {
  const key = body ? `post:${url}:${JSON.stringify(body)}` : null;
  return useApiData<T>(
    key,
    () => postFetcher([url, body]).then((d) => d as T),
    options
  );
}

export type { SWRConfiguration };
