import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

const STATUS_PAGE_SUMMARY_URL = "https://status.afeonbooks.com/api/v2/summary.json";
const STATUS_PAGE_URL = "https://status.afeonbooks.com/";
const REFRESH_INTERVAL_MS = 60_000;

interface StatusPageIncident {
  name: string;
  status: string;
}

interface StatusPageSummary {
  incidents?: StatusPageIncident[];
  status?: {
    indicator?: string;
    description?: string;
  };
}

interface StoreBanner {
  title: string;
  message: string;
  linkUrl: string;
  linkLabel: string;
  backgroundColor: string;
  textColor: string;
}

export function StatusBanner() {
  const [summary, setSummary] = useState<StatusPageSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const checkStatus = async () => {
      try {
        const response = await fetch(STATUS_PAGE_SUMMARY_URL, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        setSummary((await response.json()) as StatusPageSummary);
      } catch {
        if (!controller.signal.aborted) setSummary(null);
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const incident = summary?.incidents?.[0];
  const status = summary?.status;
  if (!incident && (!status || status.indicator === "none")) return null;

  return (
    <div className="bg-[#9d2f20] px-5 py-3 text-white" role="alert">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 text-center text-sm font-medium sm:text-[15px]">
        <AlertTriangle className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
        <span>
          {incident ? (
            <>
              Service incident: {incident.name}
              <span className="ml-1.5 text-white/75">({incident.status})</span>
            </>
          ) : (
            <>Service status: {status?.description ?? "Service disruption"}</>
          )}
        </span>
        <a
          href={STATUS_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-bold underline underline-offset-2 hover:text-white/80"
        >
          Details
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
