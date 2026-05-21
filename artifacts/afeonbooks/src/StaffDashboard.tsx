import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { savePOSOrder, type POSOrderData } from "./POSCheckout";

function playChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.start(start);
      osc.stop(start + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

interface PickupAlert {
  id: string;
  receivedAt: string;
  title: string;
  message: string;
  done: boolean;
}

type ConnStatus = "connecting" | "connected" | "error";

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const ADMIN_PIN = "1748";
const ALERTS_KEY = "afeonbooks-alerts";

function loadAlerts(): PickupAlert[] {
  try {
    const raw = sessionStorage.getItem(ALERTS_KEY);
    return raw ? (JSON.parse(raw) as PickupAlert[]) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PickupAlert[]) {
  sessionStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

function parseOrderFromAlert(alert: PickupAlert): POSOrderData {
  const msg = alert.message;

  const customerMatch = msg.match(/Customer:\s*(.+)/i);
  const customerName = customerMatch ? customerMatch[1].trim() : "";

  const totalMatch = msg.match(/Total:\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
  const totalCents = totalMatch
    ? Math.round(parseFloat(totalMatch[1].replace(/,/g, "")) * 100)
    : 0;

  const itemsMatch = msg.match(/Items:\s*(.+)/i);
  const items: POSOrderData["items"] = [];
  if (itemsMatch) {
    itemsMatch[1].split(",").forEach((part) => {
      const trimmed = part.trim();
      const qtyMatch = trimmed.match(/^(\d+)[×x×]\s*(.+)/);
      if (qtyMatch) {
        items.push({ qty: parseInt(qtyMatch[1]), name: qtyMatch[2].trim(), priceCents: 0 });
      } else if (trimmed) {
        items.push({ qty: 1, name: trimmed, priceCents: 0 });
      }
    });
  }

  const orderIdMatch = alert.title.match(/Order\s*#?(\d+)/i);
  const orderId = orderIdMatch ? orderIdMatch[1] : "";

  if (items.length === 1) {
    items[0].priceCents = totalCents;
  }

  return { alertId: alert.id, orderId, title: `Order #${orderId}`, customerName, items, totalCents };
}

export function StaffDashboard() {
  const [, navigate] = useLocation();
  const [alerts, setAlertsState] = useState<PickupAlert[]>(loadAlerts);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");
  const [soundOn, setSoundOn] = useState(true);
  const [, setTick] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const soundOnRef = useRef(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  const setAlerts = (updater: PickupAlert[] | ((prev: PickupAlert[]) => PickupAlert[])) => {
    setAlertsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveAlerts(next);
      return next;
    });
  };

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const completedId = params.get("completed");
    if (completedId) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === completedId ? { ...a, done: true } : a))
      );
      window.history.replaceState({}, "", "/admin");
    }
  }, []);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      setConnStatus("connecting");
      const es = new EventSource("https://ntfy.sh/afeonbooks-pickup/sse");
      esRef.current = es;

      es.addEventListener("open", () => setConnStatus("connected"));

      es.addEventListener("message", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.event === "keepalive") return;
          if (data.event !== "message") return;

          const alert: PickupAlert = {
            id: data.id ?? String(Date.now()),
            receivedAt: new Date(data.time ? data.time * 1000 : Date.now()).toISOString(),
            title: data.title ?? "Pickup Request",
            message: data.message ?? "",
            done: false,
          };

          setAlerts((prev) => {
            if (prev.some((a) => a.id === alert.id)) return prev;
            return [alert, ...prev];
          });
          if (soundOnRef.current) playChime();
        } catch {}
      });

      es.addEventListener("error", () => {
        setConnStatus("error");
        es.close();
        retryTimeout = setTimeout(connect, 5000);
      });
    }

    connect();
    const tickInterval = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      esRef.current?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(tickInterval);
    };
  }, []);

  const markDone = (id: string) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, done: true } : a)));

  const dismiss = (id: string) =>
    setAlerts((prev) => prev.filter((a) => a.id !== id));

  const clearAll = () => setAlerts([]);

  const handleHandOff = (alert: PickupAlert) => {
    const orderData = parseOrderFromAlert(alert);
    savePOSOrder(orderData);
    const orderIdMatch = alert.title.match(/Order\s*#?(\d+)/i);
    const orderId = orderIdMatch ? orderIdMatch[1] : undefined;
    const query = new URLSearchParams();
    if (orderId) query.set("orderId", orderId);
    query.set("step", "payment");
    navigate(`/admin/pos?${query.toString()}`);
  };

  const pending = alerts.filter((a) => !a.done);
  const done = alerts.filter((a) => a.done);

  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]">
      {/* Nav */}
      <header className="border-b border-black/10 px-6 md:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/afeonbooks-logo.png"
            alt="AFEON Books"
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="text-base font-bold uppercase tracking-widest">AFEON Books</span>
        </div>
        <div className="flex items-center gap-5">
          <StatusPill status={connStatus} />
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next) playChime();
            }}
            title={soundOn ? "Mute alerts" : "Unmute alerts"}
            className="text-xs uppercase tracking-widest font-bold text-black/40 hover:text-black transition-colors flex items-center gap-1.5"
          >
            {soundOn ? "🔔" : "🔕"}
            <span>{soundOn ? "Sound on" : "Muted"}</span>
          </button>
          <Link
            href="/admin/sales"
            className="text-xs uppercase tracking-widest font-bold text-black/40 hover:text-black transition-colors"
          >
            Sales →
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest font-bold text-black/40 hover:text-black transition-colors"
          >
            Customer View
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-12 py-10 max-w-3xl w-full mx-auto">
        {!authenticated ? (
          <PinGate
            onUnlock={() => setAuthenticated(true)}
            pinError={pinError}
            setPinError={setPinError}
          />
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-8">
              <div>
                <p className="text-amber-800 font-semibold text-sm uppercase tracking-widest mb-1">
                  Staff Dashboard
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-black">Pickup Queue</h1>
              </div>
              {alerts.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs uppercase tracking-widest font-bold text-black/30 hover:text-red-600 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {pending.length === 0 && done.length === 0 ? (
              <div className="border border-black/10 bg-white px-8 py-16 text-center">
                <p className="text-3xl mb-3">📚</p>
                <p className="text-sm font-bold uppercase tracking-widest text-black/30 mb-1">
                  All clear
                </p>
                <p className="text-sm text-black/40">
                  Pickup alerts will appear here in real time.
                </p>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <section className="mb-10">
                    <h2 className="text-xs uppercase tracking-widest font-bold text-black/40 mb-4 flex items-center gap-2">
                      Waiting
                      <span className="bg-amber-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {pending.length}
                      </span>
                    </h2>
                    <div className="flex flex-col gap-3">
                      {pending.map((a) => (
                        <AlertCard
                          key={a.id}
                          alert={a}
                          onHandOff={() => handleHandOff(a)}
                          onDismiss={() => dismiss(a.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {done.length > 0 && (
                  <section>
                    <h2 className="text-xs uppercase tracking-widest font-bold text-black/40 mb-4">
                      Handed Off
                    </h2>
                    <div className="flex flex-col gap-3">
                      {done.map((a) => (
                        <AlertCard
                          key={a.id}
                          alert={a}
                          done
                          onDismiss={() => dismiss(a.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-black/10 px-6 md:px-12 h-12 flex items-center">
        <p className="text-xs uppercase tracking-widest font-bold text-black/30">
          © AFEON Books — Staff View
        </p>
      </footer>
    </div>
  );
}

function StatusPill({ status }: { status: ConnStatus }) {
  const map: Record<ConnStatus, { dot: string; label: string }> = {
    connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
    connected: { dot: "bg-green-500", label: "Live" },
    error: { dot: "bg-red-500 animate-pulse", label: "Reconnecting…" },
  };
  const { dot, label } = map[status];
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-black/40">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function AlertCard({
  alert,
  done,
  onHandOff,
  onDismiss,
}: {
  alert: PickupAlert;
  done?: boolean;
  onHandOff?: () => void;
  onDismiss: () => void;
}) {
  const lines = alert.message.split("\n").filter(Boolean);

  return (
    <div
      className={`border bg-white px-5 py-4 flex gap-4 transition-opacity ${
        done ? "border-black/10 opacity-50" : "border-black/20"
      }`}
    >
      <div className="pt-1 shrink-0">
        <span
          className={`block w-2.5 h-2.5 rounded-full ${
            done ? "bg-black/20" : "bg-amber-800 animate-pulse"
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <p className="text-sm font-bold text-black truncate">{alert.title}</p>
          <span className="text-xs text-black/30 shrink-0">{timeAgo(alert.receivedAt)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-black/60 leading-snug">
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0 justify-between">
        {!done && onHandOff && (
          <button
            onClick={onHandOff}
            className="rounded-none bg-black hover:bg-teal-600 text-white px-4 py-2 font-bold uppercase tracking-widest text-[10px] transition-colors whitespace-nowrap"
          >
            Hand Off ✓
          </button>
        )}
        {done && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-teal-600">
            Done ✓
          </span>
        )}
        <button
          onClick={onDismiss}
          className="text-[10px] uppercase tracking-widest font-bold text-black/25 hover:text-red-500 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function PinGate({
  onUnlock,
  pinError,
  setPinError,
}: {
  onUnlock: () => void;
  pinError: boolean;
  setPinError: (v: boolean) => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    if (!clean) return;
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setPinError(false);
    if (index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = digits.join("");
    if (pin === ADMIN_PIN) {
      onUnlock();
      setPinError(false);
    } else {
      setPinError(true);
      setDigits(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-6">
        <img src="/afeonbooks-logo.png" alt="AFEON Books" className="h-12 w-12 rounded-full object-cover" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-black mb-1">Admin Access</h2>
          <p className="text-xs text-black/40">Enter your 4-digit PIN to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-10 h-10 border border-black/20 bg-white text-center text-sm font-bold text-black focus:outline-none focus:border-black transition-colors rounded-none"
                autoFocus={i === 0}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-red-600 text-xs font-bold uppercase tracking-widest">Incorrect PIN</p>
          )}
          <button
            type="submit"
            disabled={digits.join("").length !== 4}
            className="w-full rounded-none bg-black hover:bg-amber-800 text-white px-10 py-3 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-40"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
