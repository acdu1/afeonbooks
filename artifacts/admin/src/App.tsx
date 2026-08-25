import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Editor from "@/pages/editor";
import Pos from "@/pages/pos";
import Dev from "@/pages/dev";

const queryClient = new QueryClient();

function DebugOverlay() {
  const [altPressed, setAltPressed] = useState(false);
  const [info, setInfo] = useState<{ build: string; ip: string } | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAltPressed(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAltPressed(false);
    };
    const onBlur = () => setAltPressed(false);
    const onResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!altPressed || info) return;
    let cancelled = false;
    fetch("/api/debug-info", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ build?: string; ip?: string }>)
      .then((data) => {
        if (!cancelled) setInfo({ build: data.build ?? "unknown", ip: data.ip ?? "unknown" });
      })
      .catch(() => {
        if (!cancelled) setInfo({ build: "unknown", ip: "unknown" });
      });
    return () => { cancelled = true; };
  }, [altPressed, info]);

  if (!altPressed) return null;

  return (
    <div
      style={{ position: "fixed", top: 8, right: 8, zIndex: 2147483647 }}
      className="pointer-events-none select-none bg-black text-white px-3 py-2 font-mono text-xs leading-5 shadow-lg"
    >
      <div>dimensions: {dimensions.width}×{dimensions.height}</div>
      <div>build #: {info?.build ?? "loading…"}</div>
      <div>ip: {info?.ip ?? "loading…"}</div>
    </div>
  );
}

function AdminHome() {
  const [devOpen, setDevOpen] = useState(() => window.location.hash === "#dev");

  useEffect(() => {
    const onHashChange = () => setDevOpen(window.location.hash === "#dev");
    window.addEventListener("hashchange", onHashChange);

    const installDevTab = () => {
      if (window.location.hash === "#dev") return;
      if (document.querySelector("[data-admin-dev-tab='true']")) return;

      const tabs = Array.from(document.querySelectorAll("button")).filter((button) => {
        const text = button.textContent?.trim() ?? "";
        return text === "Site Content" || text === "Recent Orders";
      });
      const anchor = tabs[tabs.length - 1];
      const parent = anchor?.parentElement;
      if (!parent) return;

      const devTab = document.createElement("button");
      devTab.type = "button";
      devTab.dataset.adminDevTab = "true";
      devTab.className = "pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors border-transparent text-black/40 hover:text-black/80";
      devTab.textContent = "Dev";
      devTab.addEventListener("click", () => {
        window.location.hash = "dev";
      });
      parent.appendChild(devTab);
    };

    installDevTab();
    const observer = new MutationObserver(installDevTab);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      observer.disconnect();
    };
  }, []);

  return devOpen ? <Dev /> : <Editor />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminHome} />
      <Route path="/pos" component={Pos} />
      <Route path="/pos/" component={Pos} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // POS CHECKOUT must always be a hard navigation to the real admin POS URL.
    // This bypasses any dashboard/link handler that tries to send the user back to /admin.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest<HTMLElement>("button, a");
      if (!control) return;

      const label = control.textContent?.replace(/\s+/g, " ").trim().toUpperCase();
      if (label !== "POS CHECKOUT") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.href = `${window.location.origin}/admin/pos/`;
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors />
        <DebugOverlay />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
