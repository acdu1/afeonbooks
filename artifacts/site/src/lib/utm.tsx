import React, { createContext, useContext, useEffect, useState } from "react";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export interface UtmData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt?: string;
}

const STORAGE_KEY = "afeon_utm";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UtmContextValue {
  utm: UtmData;
  clear: () => void;
}

const UtmContext = createContext<UtmContextValue | undefined>(undefined);

function snakeToCamel(key: string): keyof UtmData {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof UtmData;
}

function loadStored(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UtmData;
    if (parsed.capturedAt) {
      const age = Date.now() - new Date(parsed.capturedAt).getTime();
      if (Number.isNaN(age) || age > TTL_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return {};
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function captureFromUrl(): UtmData | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const found: UtmData = {};
  let any = false;
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) {
      any = true;
      (found as Record<string, string>)[snakeToCamel(k)] = v;
    }
  }
  if (!any) return null;
  found.referrer = document.referrer || undefined;
  found.landingPage = window.location.pathname + window.location.search;
  found.capturedAt = new Date().toISOString();
  return found;
}

export function UtmProvider({ children }: { children: React.ReactNode }) {
  const [utm, setUtm] = useState<UtmData>(() => loadStored());

  useEffect(() => {
    const fresh = captureFromUrl();
    if (fresh) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch {}
      setUtm(fresh);
    }
  }, []);

  const clear = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUtm({});
  };

  return <UtmContext.Provider value={{ utm, clear }}>{children}</UtmContext.Provider>;
}

export function useUtm() {
  const ctx = useContext(UtmContext);
  if (!ctx) throw new Error("useUtm must be used within UtmProvider");
  return ctx;
}

export function utmPayload(utm: UtmData): Partial<UtmData> {
  const out: Partial<UtmData> = {};
  if (utm.utmSource) out.utmSource = utm.utmSource;
  if (utm.utmMedium) out.utmMedium = utm.utmMedium;
  if (utm.utmCampaign) out.utmCampaign = utm.utmCampaign;
  if (utm.utmTerm) out.utmTerm = utm.utmTerm;
  if (utm.utmContent) out.utmContent = utm.utmContent;
  if (utm.referrer) out.referrer = utm.referrer;
  if (utm.landingPage) out.landingPage = utm.landingPage;
  return out;
}
