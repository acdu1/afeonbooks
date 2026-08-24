import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Editor from "@/pages/editor";
import Pos from "@/pages/pos";
import Dev from "@/pages/dev";
import { MaintenancePage } from './pages/maintenance';

export function App() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        // Check if MAINTENANCE env var is set to true
        const response = await fetch('/api/maintenance-status');
        const data = await response.json();
        setIsMaintenance(data.maintenance === true);
      } catch (error) {
        console.error('Failed to check maintenance status:', error);
        // Fail open - show app normally if check fails
        setIsMaintenance(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkMaintenance();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isMaintenance) {
    return <MaintenancePage />;
  }

  return <YourActualApp />;
}

const queryClient = new QueryClient();

function AdminHome() {
  const [devOpen, setDevOpen] = useState(() => window.location.hash === "#dev");

  useEffect(() => {
    const onHashChange = () => setDevOpen(window.location.hash === "#dev");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
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
    return () => observer.disconnect();
  }, []);

  return devOpen ? <Dev /> : <Editor />;
}

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={() => <Redirect to="/admin/" />} />
      <Route path="/admin/" component={AdminHome} />
      <Route path="/admin/pos" component={Pos} />
      <Route path="/pos" component={() => <Redirect to="/admin/pos" />} />
      <Route path="/" component={() => <Redirect to="/admin/" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
