import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPPORTED_SUPABASE_PORTS = [5432, 6543];

export default function Dev() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [devTesting, setDevTesting] = useState<{ active: boolean; expiresAt: string | null } | null>(null);
  const [port, setPort] = useState("");
  const [portMessage, setPortMessage] = useState("");
  const [logStreamUrl, setLogStreamUrl] = useState(() => localStorage.getItem("renderLogStreamUrl") ?? "");
  const [savedLogUrl, setSavedLogUrl] = useState(() => localStorage.getItem("renderLogStreamUrl") ?? "");

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

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const testPort = () => {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      setPortMessage("Enter a valid port from 1–65535.");
      return;
    }
    if (SUPPORTED_SUPABASE_PORTS.includes(value)) {
      setPortMessage(`Port ${value} is a supported Supabase PostgreSQL connection port. Supabase Free does not allow arbitrary public ports; this checks a supported connection port rather than opening a new listener.`);
    } else {
      setPortMessage(`Port ${value} is not a Supabase Free PostgreSQL port. Use 5432 or 6543.`);
    }
  };

  const saveLogStream = () => {
    const value = logStreamUrl.trim();
    if (value) {
      localStorage.setItem("renderLogStreamUrl", value);
    } else {
      localStorage.removeItem("renderLogStreamUrl");
    }
    setSavedLogUrl(value);
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
            <Button type="button" className="rounded-none bg-black text-white hover:bg-black/80" onClick={() => void checkHealth()}>Refresh</Button>
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

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Render Log Stream</h2>
            <p className="text-sm text-black/50 mt-1">Save your Render Log Stream URL here. The URL is stored only in this browser.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <Input value={logStreamUrl} onChange={(e) => setLogStreamUrl(e.target.value)} placeholder="https://…" className="rounded-none flex-1" />
            <Button type="button" onClick={saveLogStream} className="rounded-none bg-black text-white hover:bg-black/80">Save</Button>
          </div>
          {savedLogUrl ? (
            <div className="border border-black/10 bg-[#FAF7F2] p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest font-bold text-black/40">Saved stream</p>
              <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <span className="font-mono text-xs break-all">{savedLogUrl}</span>
                <Button type="button" variant="outline" className="rounded-none shrink-0" onClick={() => window.open(savedLogUrl, "_blank", "noopener,noreferrer")}>Open Stream</Button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-black/20 p-6 text-sm text-black/50">Not configured yet.</div>
          )}
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-6 space-y-4">
          <h2 className="text-xl font-bold">Environment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="border border-black/10 p-4"><span className="text-black/40">Frontend</span><br/><span className="font-mono text-xs">Cloudflare Workers</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">API</span><br/><span className="font-mono text-xs">https://afeonbooks-api.onrender.com</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">Database</span><br/><span className="font-mono text-xs">Supabase PostgreSQL</span></div>
            <div className="border border-black/10 p-4"><span className="text-black/40">Admin base</span><br/><span className="font-mono text-xs">/admin/</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
