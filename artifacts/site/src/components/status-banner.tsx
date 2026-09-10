import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

const STATUS_PAGE_SUMMARY_URL = "https://afeonbooks.statuspage.io/api/v2/summary.json";
const STATUS_PAGE_URL = "https://afeonbooks.statuspage.io/";
const REFRESH_INTERVAL_MS = 60_000;

interface StatusPageIncident {
  name: string;
  status: string;
}

interface StatusPageSummary {
  incidents: StatusPageIncident[];
}

export function StatusBanner() {
  const [incident, setIncident] = useState<StatusPageIncident | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const checkStatus = async () => {
      try {
        const response = await fetch(STATUS_PAGE_SUMMARY_URL, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const summary = (await response.json()) as StatusPageSummary;
        setIncident(summary.incidents?.[0] ?? null);
      } catch {
        if (!controller.signal.aborted) setIncident(null);
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  if (!incident) return null;

  return (
    <div className="bg-[#9d2f20] px-5 py-3 text-white" role="alert">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 text-center text-sm font-medium sm:text-[15px]">
        <AlertTriangle className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
        <span>
          Service incident: {incident.name}
          <span className="ml-1.5 text-white/75">({incident.status})</span>
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