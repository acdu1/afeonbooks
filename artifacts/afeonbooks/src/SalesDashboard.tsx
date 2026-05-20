import { useRef, useState } from "react";
import { Link } from "wouter";

const ALERTS_KEY = "afeonbooks-alerts";
const ADMIN_PIN = "1748";

interface RawAlert {
  id: string;
  receivedAt: string;
  title: string;
  message: string;
  done: boolean;
}

interface SaleRecord {
  id: string;
  receivedAt: Date;
  orderRef: string;
  customerName: string;
  items: string[];
  totalCents: number;
}

function parseAlerts(): SaleRecord[] {
  try {
    const raw = sessionStorage.getItem(ALERTS_KEY);
    if (!raw) return [];
    const alerts: RawAlert[] = JSON.parse(raw);
    return alerts
      .filter((a) => a.done)
      .map((a) => {
        const msg = a.message;

        const customerMatch = msg.match(/Customer:\s*(.+)/i);
        const customerName = customerMatch ? customerMatch[1].trim() : "Unknown";

        const totalMatch = msg.match(/Total:\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
        const totalCents = totalMatch
          ? Math.round(parseFloat(totalMatch[1].replace(/,/g, "")) * 100)
          : 0;

        const itemsMatch = msg.match(/Items:\s*(.+)/i);
        const items = itemsMatch
          ? itemsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
          : [];

        const orderRefMatch = a.title.match(/Order\s*#?(\d+)/i);
        const orderRef = orderRefMatch ? `#${orderRefMatch[1]}` : a.id.slice(0, 6);

        return {
          id: a.id,
          receivedAt: new Date(a.receivedAt),
          orderRef,
          customerName,
          items,
          totalCents,
        };
      })
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  } catch {
    return [];
  }
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(d: Date) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function SalesDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]">
      {/* Header */}
      <header className="h-14 px-5 flex items-center justify-between border-b border-black/10 bg-[#FAF7F2]">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-black/50 hover:text-black transition-colors p-1"
            aria-label="Back to dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12 4L6 10L12 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <img
            src="/afeonbooks-logo.png"
            alt="AFEON Books"
            className="h-7 w-7 rounded-full object-cover"
          />
          <div className="leading-none">
            <p className="text-sm font-bold text-black">Sales Summary</p>
            <p className="text-[11px] text-black/40 font-medium">
              {formatDateLong(new Date())}
            </p>
          </div>
        </div>
        <Link
          href="/admin"
          className="text-[11px] font-bold uppercase tracking-widest text-black/30 hover:text-black transition-colors"
        >
          — Admin
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {!authenticated ? (
            <PinGate
              onUnlock={() => setAuthenticated(true)}
              pinError={pinError}
              setPinError={setPinError}
            />
          ) : (
            <SalesContent />
          )}
        </div>
      </main>

      <footer className="border-t border-black/10 px-6 h-12 flex items-center">
        <p className="text-xs uppercase tracking-widest font-bold text-black/30">
          © AFEON Books — Sales View
        </p>
      </footer>
    </div>
  );
}

function SalesContent() {
  const records = parseAlerts();
  const today = records.filter((r) => isToday(r.receivedAt));
  const earlier = records.filter((r) => !isToday(r.receivedAt));

  const todayRevenue = today.reduce((s, r) => s + r.totalCents, 0);
  const sessionRevenue = records.reduce((s, r) => s + r.totalCents, 0);
  const avgCents = today.length > 0 ? Math.round(todayRevenue / today.length) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Today's Revenue"
          value={formatCents(todayRevenue)}
          sub={`${today.length} order${today.length !== 1 ? "s" : ""}`}
          accent
        />
        <StatCard
          label="Avg Order"
          value={today.length > 0 ? formatCents(avgCents) : "—"}
          sub="per transaction"
        />
        <StatCard
          label="Session Total"
          value={formatCents(sessionRevenue)}
          sub={`${records.length} total`}
        />
      </div>

      {/* Today's transactions */}
      {today.length === 0 && earlier.length === 0 ? (
        <div className="border border-black/10 bg-white px-8 py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm font-bold uppercase tracking-widest text-black/30 mb-1">
            No sales yet
          </p>
          <p className="text-sm text-black/40">
            Completed orders will appear here after hand-off.
          </p>
        </div>
      ) : (
        <>
          {today.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/40">
                  Today's Orders
                </h2>
                <span className="text-xs font-bold text-amber-800">
                  {formatCents(todayRevenue)} collected
                </span>
              </div>
              <div className="border border-black/12 bg-white divide-y divide-black/8">
                {today.map((r) => (
                  <SaleRow key={r.id} record={r} />
                ))}
                {/* Subtotal row */}
                <div className="px-5 py-3 flex items-center justify-between bg-black/[0.02]">
                  <span className="text-xs font-bold uppercase tracking-widest text-black/50">
                    Day Total
                  </span>
                  <span className="text-base font-bold text-black">
                    {formatCents(todayRevenue)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {earlier.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-3">
                Earlier This Session
              </h2>
              <div className="border border-black/12 bg-white divide-y divide-black/8 opacity-70">
                {earlier.map((r) => (
                  <SaleRow key={r.id} record={r} showDate />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Reconciliation note */}
      <div className="border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-1">
          End-of-Day Note
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Sales data is stored for this browser session only. Print or note totals before closing
          the tab. Expected cash in drawer:{" "}
          <strong>{formatCents(todayRevenue)}</strong> from{" "}
          <strong>{today.length}</strong> transaction{today.length !== 1 ? "s" : ""} today.
        </p>
      </div>

      {/* Print button */}
      <button
        onClick={() => printSummary(today, todayRevenue)}
        className="w-full border border-black/20 bg-white hover:bg-black/5 text-black px-6 py-3.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path
            d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Print Day Summary
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`border px-4 py-4 flex flex-col gap-1 ${
        accent ? "border-amber-800/20 bg-amber-50" : "border-black/12 bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-amber-900" : "text-black"}`}>{value}</p>
      <p className="text-[11px] text-black/40 font-medium">{sub}</p>
    </div>
  );
}

function SaleRow({ record, showDate }: { record: SaleRecord; showDate?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-bold text-black/30 shrink-0">
            {showDate
              ? record.receivedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : formatTime(record.receivedAt)}
          </span>
          <span className="text-xs font-bold text-black/50 shrink-0">{record.orderRef}</span>
          <span className="text-sm font-medium text-black truncate">{record.customerName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-black">{formatCents(record.totalCents)}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`text-black/30 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {open && record.items.length > 0 && (
        <div className="px-5 pb-3 bg-black/[0.015]">
          {record.items.map((item, i) => (
            <p key={i} className="text-xs text-black/50 leading-relaxed">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function printSummary(records: SaleRecord[], totalCents: number) {
  const now = new Date();
  const rows = records
    .map(
      (r) =>
        `<tr>
          <td>${formatTime(r.receivedAt)}</td>
          <td>${r.orderRef}</td>
          <td>${r.customerName}</td>
          <td style="text-align:right;font-weight:bold;">${formatCents(r.totalCents)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>AFEON Books – Day Summary</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; padding: 24px; }
  h1 { font-size: 18px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .sub { color: #555; margin-bottom: 16px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; border-bottom: 2px solid #000; padding: 4px 6px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  td { padding: 5px 6px; border-bottom: 1px dashed #ccc; vertical-align: top; }
  .total-row td { border-top: 2px solid #000; border-bottom: none; font-weight: bold; font-size: 14px; padding-top: 8px; }
  .footer { margin-top: 16px; font-size: 11px; color: #555; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>AFEON Books</h1>
  <p class="sub">Daily Sales Summary — ${formatDateLong(now)}<br>Printed ${formatTime(now)}</p>
  <table>
    <thead>
      <tr>
        <th>Time</th><th>Order</th><th>Customer</th><th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" style="color:#999;text-align:center;padding:12px;">No orders today</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">DAY TOTAL (${records.length} order${records.length !== 1 ? "s" : ""})</td>
        <td style="text-align:right;">${formatCents(totalCents)}</td>
      </tr>
    </tfoot>
  </table>
  <p class="footer">Cash expected in drawer: <strong>${formatCents(totalCents)}</strong></p>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=620,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
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
        <img
          src="/afeonbooks-logo.png"
          alt="AFEON Books"
          className="h-12 w-12 rounded-full object-cover"
        />
        <div className="text-center">
          <h2 className="text-lg font-bold text-black mb-1">Sales Summary</h2>
          <p className="text-xs text-black/40">Enter your PIN to view sales data</p>
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
            <p className="text-red-600 text-xs font-bold uppercase tracking-widest">
              Incorrect PIN
            </p>
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
