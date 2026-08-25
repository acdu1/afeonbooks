import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPPORTED_SUPABASE_PORTS = [5432, 6543];
const STATUS_PAGE_URL = "https://afeonbooks.statuspage.io/";

type RenderLog = {
  id?: string;
  message?: string;
  timestamp?: string;
  labels?: Record<string, string>;
  [key: string]: unknown;
};

export default function Dev() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [devTesting, setDevTesting] = useState<{ active: boolean; expiresAt: string | null } | null>(null);
  const [port, setPort] = useState("");
  const [portMessage, setPortMessage] = useState("");
  const [renderLogs, setRenderLogs] = useState<RenderLog[]>([]);
  const [renderLogsLoading, setRenderLogsLoading] = useState(false);
  const [renderLogsError, setRenderLogsError] = useState("");
  const [renderConfigured, setRenderConfigured] = useState<boolean | null>(null);
  const [logType, setLogType] = useState<"all" | "app" | "request" | "build">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const checkHealth = useCallback(async () => {
    setApiStatus("checking");
    try {
      const [products, testing] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/dev-testing/status", { cache: "no-store" }),
      ]);
      setApiStatus(products.ok ? "online" : "offline");
      if (testing.ok) {
        setDevTesting(await testing.json() as { active: boolean; expiresAt: string | null });
      }
    } catch {
      setApiStatus("offline");
    }
  }, []);

  const loadRenderLogs = useCallback(async () => {
    setRenderLogsLoading(true);
    setRenderLogsError("");
    try {
      const query = logType === "all" ? "" : `?type=${encodeURIComponent(logType)}`;
      const response = await fetch(`/api/render-logs${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as {
        configured?: boolean;
        error?: string;
        logs?: RenderLog[];
      };
      setRenderConfigured(payload.configured !== false);
      if (!response.ok) {
        setRenderLogs([]);
        setRenderLogsError(payload.error ?? `Render logs request failed (${response.status})`);
        return;
      }
      setRenderLogs(payload.logs ?? []);
    } catch (error) {
      setRenderConfigured(true);
      setRenderLogs([]);
      setRenderLogsError(error instanceof Error ? error.message : "Unable to load Render logs.");
    } finally {
      setRenderLogsLoading(false);
    }
  }, [logType]);

  useEffect(() => {
    void checkHealth();
    void loadRenderLogs();
  }, [checkHealth, loadRenderLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void loadRenderLogs(), 5_000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadRenderLogs]);

  const testPort = () => {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      setPortMessage("Enter a valid port from 1–65535.");
      return;
    }
    if (SUPPORTED_SUPABASE_PORTS.includes(value)) {
      setPortMessage(`Port ${value} is a supported Supabase PostgreSQL connection port. Supabase Free does not allow arbitrary public listeners; this checks a supported connection port rather than opening a new listener.`);
    } else {
      setPortMessage(`Port ${value} is not a Supabase Free PostgreSQL connection port. Use 5432 or 6543.`);
    }
  };

  const statusLabel = apiStatus === "online" ? "Online" : apiStatus === "offline" ? "Offline" : "Checking…";
  const statusClass = apiStatus === "online" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : apiStatus === "offline" ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-black font-sans">
      <header className="sticky top-0 z-20 bg-white border-b border-black/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Admin</p>
            <h1 className="text-2xl font-bold">Dev</h1>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => window.location.hash = ""}>Back to Dashboard</Button>
            <Button type="button" className="rounded-none bg-black text-white hover:bg-black/80" onClick={() => { void checkHealth(); void loadRenderLogs(); }}>Refresh</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-black/5 shadow-sm p-6">
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Render API</p>
            <div className={`mt-4 inline-flex px-3 py-1 text-sm font-bold border ${statusClass}`}>{statusLabel}</div>
            <p className="mt-3 text-xs text-black/50">Checked through the Cloudflare /api proxy.</p>
          </div>
          <div className="bg-white border border-black/5 shadow-sm p-6">
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Dev Testing</p>
            <p className="mt-4 text-xl font-bold">{devTesting?.active ? "Active" : "Inactive"}</p>
            {devTesting?.expiresAt && <p className="mt-2 text-xs text-black/50">Expires {new Date(devTesting.expiresAt).toLocaleString()}</p>}
          </div>
          <div className="bg-white border border-black/5 shadow-sm p-6">
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Database</p>
            <p className="mt-4 text-xl font-bold">Supabase</p>
            <p className="mt-2 text-xs text-black/50">Render API → Supabase PostgreSQL</p>
          </div>
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Service Status</p>
            <h2 className="text-xl font-bold mt-1">AfeonBooks Status Page</h2>
            <p className="text-sm text-black/50 mt-1">Monitor uptime, incidents, and service status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={STATUS_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-bold hover:bg-black/80 transition-colors"
            >
              Open Status Page ↗
            </a>
            <div className="flex items-center px-3 py-2 border border-black/10 bg-[#FAF7F2] text-xs font-mono text-black/60 break-all">
              {STATUS_PAGE_URL}
            </div>
          </div>
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Live Render Logs</h2>
            <p className="text-sm text-black/50 mt-1">Logs are read through the Render REST API by your Render API server. They refresh every 5 seconds while Auto-refresh is enabled.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {(["all", "app", "request", "build"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLogType(type)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest border ${logType === type ? "bg-black text-white border-black" : "bg-white text-black/50 border-black/20 hover:text-black"}`}
              >
                {type}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/50">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <Button type="button" variant="outline" className="rounded-none h-8" onClick={() => void loadRenderLogs()} disabled={renderLogsLoading}>
              {renderLogsLoading ? "Loading…" : "Refresh Logs"}
            </Button>
          </div>

          {renderConfigured === false ? (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 p-5 space-y-2">
              <p className="font-bold">Render logs are not configured yet.</p>
              <p className="text-sm">Add <code className="font-mono">RENDER_API_KEY</code> to the Render API service environment variables, then redeploy the API.</p>
            </div>
          ) : renderLogsError ? (
            <div className="border border-red-200 bg-red-50 text-red-800 p-5 space-y-2">
              <p className="font-bold">Could not load Render logs.</p>
              <p className="text-sm font-mono break-all">{renderLogsError}</p>
            </div>
          ) : (
            <div className="bg-black text-white border border-black/10 rounded-none overflow-hidden">
              <div className="max-h-[520px] overflow-auto p-4 font-mono text-xs leading-5 space-y-1">
                {renderLogs.length === 0 ? (
                  <div className="text-white/40 py-8 text-center">No Render logs found in the current window.</div>
                ) : renderLogs.map((log, index) => {
                  const labels = log.labels ?? {};
                  const level = String(labels.level ?? log.level ?? "").toUpperCase();
                  const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "--:--:--";
                  const message = String(log.message ?? log.text ?? JSON.stringify(log));
                  return (
                    <div key={String(log.id ?? index)} className="whitespace-pre-wrap break-words">
                      <span className="text-white/40 mr-3">{timestamp}</span>
                      {level && <span className="text-amber-300 mr-3">{level}</span>}
                      <span>{message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Supabase Connection Test</h2>
            <p className="text-sm text-black/50 mt-1">Supabase Free uses supported PostgreSQL connection endpoints. It does not provide arbitrary public TCP listeners.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 max-w-xl">
            <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" placeholder="Port (5432 or 6543)" className="rounded-none" />
            <Button type="button" onClick={testPort} className="rounded-none bg-black text-white hover:bg-black/80">Check Port</Button>
          </div>
          <div className="text-xs font-mono text-black/60">Supported: 5432 (PostgreSQL / pooler) · 6543 (transaction pooler)</div>
          {portMessage && <div className="bg-[#FAF7F2] border border-black/10 p-4 text-sm">{portMessage}</div>}
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-bold">Environment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="border border-black/10 p-4"><span className="text-black/40">Frontend</span><br/><span className="font-mono text-xs">Cloudflare Workers</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">API</span><br/><span className="font-mono text-xs">https://afeonbooks-api.onrender.com</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">Database</span><br/><span className="font-mono text-xs">Supabase PostgreSQL</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">Render service</span><br/><span className="font-mono text-xs">srv-da57c6jbc2fs738388lg</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
