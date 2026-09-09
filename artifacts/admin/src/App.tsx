import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Editor from "@/pages/editor";
import Pos from "@/pages/pos";
import Dev from "@/pages/dev";
import ZohoMail from "@/pages/zoho-mail";

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

function OrderEmailOverlay() {
  const [orderId, setOrderId] = useState<number | null>(null);
  const [order, setOrder] = useState<{ id: number; customerName: string; customerEmail: string; totalCents: number; currency: string; status: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest<HTMLElement>("button, a, select, input, textarea");
      if (control) return;

      const row = target?.closest<HTMLTableRowElement>("tr");
      if (!row) return;
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 7) return;
      const firstText = cells[0]?.textContent?.trim() ?? "";
      const match = firstText.match(/^#(\d+)$/);
      if (!match) return;

      const id = Number(match[1]);
      if (!Number.isInteger(id)) return;
      setOrderId(id);
      setMessage("");
      setOrder(null);

      try {
        const response = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setOrder({
          id: data.id,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          totalCents: data.totalCents,
          currency: data.currency,
          status: data.status,
        });
      } catch {
        setMessage("Could not load order details.");
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (orderId === null) return null;

  const close = () => {
    if (sending) return;
    setOrderId(null);
    setOrder(null);
    setMessage("");
  };

  const resend = async () => {
    if (!orderId) return;
    setSending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/resend-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
      setMessage(data.message ?? "Email resent successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to resend email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/30 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="w-full max-w-md bg-white border border-black/10 shadow-2xl p-6 font-sans">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-black/40">Order</p>
            <h2 className="text-2xl font-bold mt-1">#{orderId}</h2>
          </div>
          <button type="button" onClick={close} className="text-black/40 hover:text-black text-xl leading-none" aria-label="Close">×</button>
        </div>

        {order ? (
          <div className="space-y-4 text-sm">
            <div><div className="text-xs uppercase tracking-widest text-black/40">Customer</div><div className="font-medium mt-1">{order.customerName}</div></div>
            <div><div className="text-xs uppercase tracking-widest text-black/40">Email</div><div className="mt-1">{order.customerEmail}</div></div>
            <div><div className="text-xs uppercase tracking-widest text-black/40">Total</div><div className="font-bold mt-1">{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</div></div>
            <div><div className="text-xs uppercase tracking-widest text-black/40">Status</div><div className="mt-1 capitalize">{order.status}</div></div>

            <button
              type="button"
              onClick={resend}
              disabled={sending}
              className="w-full mt-2 bg-black text-white py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
            >
              {sending ? "Resending…" : "Resend Email"}
            </button>

            {message && (
              <p className={`text-sm ${message.toLowerCase().includes("resent") || message.toLowerCase().includes("success") ? "text-emerald-700" : "text-red-600"}`}>
                {message}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-black/50">{message || "Loading order…"}</p>
        )}
      </div>
    </div>
  );
}

function AdminHome() {
  const [devOpen, setDevOpen] = useState(() => window.location.hash === "#dev");

  useEffect(() => {
    const onHashChange = () => setDevOpen(window.location.hash === "#dev");
    window.addEventListener("hashchange", onHashChange);

    const installAdminTools = () => {
      const tabs = Array.from(document.querySelectorAll("button")).filter((button) => {
        const text = button.textContent?.trim() ?? "";
        return text === "Site Content" || text === "Recent Orders";
      });
      const anchor = tabs[tabs.length - 1];
      const parent = anchor?.parentElement;
      if (!parent) return;

      if (!document.querySelector("[data-admin-dev-tab='true']")) {
        const devTab = document.createElement("button");
        devTab.type = "button";
        devTab.dataset.adminDevTab = "true";
        devTab.className = "pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors border-transparent text-black/40 hover:text-black/80";
        devTab.textContent = "Dev";
        devTab.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.location.hash = "dev";
        });
        parent.appendChild(devTab);
      }

      if (!document.querySelector("[data-admin-zoho-tab='true']")) {
        const zohoTab = document.createElement("button");
        zohoTab.type = "button";
        zohoTab.dataset.adminZohoTab = "true";
        zohoTab.className = "pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors border-transparent text-black/40 hover:text-black/80";
        zohoTab.textContent = "Zoho Mail";
        zohoTab.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          window.location.hash = "zoho-mail";
        });
        parent.appendChild(zohoTab);
      }

      // Keep the existing Email tab's provider wording aligned with the Zoho transport.
      document.querySelectorAll("input[name='emailFromAddress']").forEach((input) => {
        const el = input as HTMLInputElement;
        el.placeholder = "noreply@afeonbooks.com";
        if (el.value === "onboarding@resend.dev") {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(el, "noreply@afeonbooks.com");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const replacements: Array<[string, string]> = [
        ["Use any sender address at a domain verified in MailerSend.", "Sender address is managed by Zoho Mail. AFEON Books sends from noreply@afeonbooks.com."],
        ["MailerSend", "Zoho Mail"],
      ];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue ?? "";
        let next = text;
        for (const [from, to] of replacements) next = next.replaceAll(from, to);
        if (next !== text) node.nodeValue = next;
      }
    };

    installAdminTools();
    const observer = new MutationObserver(installAdminTools);
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
      <Route path="/pos/" component={Pos} />
      <Route path="/pos" component={Pos} />
      <Route path="/zoho-mail" component={ZohoMail} />
      <Route path="/zoho-mail/" component={ZohoMail} />
      <Route path="/" component={AdminHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isPosPath = window.location.pathname === "/admin/pos" || window.location.pathname === "/admin/pos/";
  const isZohoMailPath = window.location.pathname === "/admin/zoho-mail" || window.location.pathname === "/admin/zoho-mail/";
  const [adminView, setAdminView] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setAdminView(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest<HTMLElement>("button, a");
      if (!control) return;

      const label = control.textContent?.replace(/\s+/g, " ").trim().toUpperCase();
      if (label !== "POS CHECKOUT") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.assign(`${window.location.origin}/admin/pos/`);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isPosPath ? (
          <Pos />
        ) : isZohoMailPath || adminView === "#zoho-mail" ? (
          <ZohoMail />
        ) : (
          <WouterRouter base="/admin">
            <Router />
          </WouterRouter>
        )}
        <Toaster position="top-center" richColors />
        <DebugOverlay />
        {!isPosPath && !isZohoMailPath && <OrderEmailOverlay />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
