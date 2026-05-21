import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

export interface POSOrderData {
  alertId: string;
  orderId?: string;
  title: string;
  customerName: string;
  items: { name: string; qty: number; priceCents: number }[];
  totalCents: number;
}

const SESSION_KEY = "afeonbooks-pos-order";
const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function savePOSOrder(data: POSOrderData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadPOSOrder(): POSOrderData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as POSOrderData) : null;
  } catch {
    return null;
  }
}

type POSStep = "payment" | "signature" | "done";

function stepFromLocation(): POSStep {
  const params = new URLSearchParams(window.location.search);
  const step = params.get("step");
  if (step === "signature" || step === "done") return step;
  const h = window.location.hash;
  if (h === "#signature") return "signature";
  if (h === "#done") return "done";
  return "payment";
}

function printReceipt(order: POSOrderData, cashCents: number, changeCents: number) {
  const now = new Date();
  const itemRows = order.items
    .map(
      (it) =>
        `<tr>
          <td style="padding:3px 0;">${it.qty > 1 ? `${it.qty}× ` : ""}${it.name}</td>
          <td style="padding:3px 0;text-align:right;">${it.priceCents > 0 ? formatCents(it.priceCents * it.qty) : ""}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt — ${order.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    color: #000;
    background: #fff;
    display: flex;
    justify-content: center;
    padding: 24px 16px;
  }
  .receipt {
    width: 300px;
  }
  .logo {
    text-align: center;
    margin-bottom: 4px;
  }
  .store-name {
    text-align: center;
    font-size: 17px;
    font-weight: bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .store-sub {
    text-align: center;
    font-size: 10px;
    color: #555;
    margin-bottom: 12px;
    line-height: 1.5;
  }
  .divider {
    border: none;
    border-top: 1px dashed #999;
    margin: 8px 0;
  }
  .meta {
    font-size: 11px;
    color: #444;
    margin-bottom: 8px;
    line-height: 1.6;
  }
  .customer {
    font-weight: bold;
    font-size: 13px;
    margin-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }
  td { vertical-align: top; }
  .total-row td {
    font-weight: bold;
    font-size: 15px;
    padding-top: 8px;
    border-top: 1px solid #000;
  }
  .cash-row td, .change-row td {
    padding: 2px 0;
    color: #333;
  }
  .footer {
    text-align: center;
    font-size: 11px;
    color: #666;
    margin-top: 12px;
    line-height: 1.7;
  }
  .thank-you {
    text-align: center;
    font-weight: bold;
    font-size: 14px;
    margin-top: 10px;
    letter-spacing: 0.05em;
  }
  @media print {
    body { padding: 0; }
    .receipt { width: 100%; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="store-name">AFEON Books</div>
  <div class="store-sub">Order Pickup Receipt<br>afeonbooks.replit.app</div>

  <hr class="divider">

  <div class="meta">
    Date: ${formatDate(now)}<br>
    Time: ${formatTime(now)}<br>
    Order: ${order.title}
  </div>

  <hr class="divider">

  <div class="customer">${order.customerName || "Customer"}</div>

  <table>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL DUE</td>
        <td style="text-align:right;">${formatCents(order.totalCents)}</td>
      </tr>
      <tr class="cash-row">
        <td>Cash Received</td>
        <td style="text-align:right;">${formatCents(cashCents)}</td>
      </tr>
      <tr class="change-row">
        <td>Change Given</td>
        <td style="text-align:right;">${formatCents(Math.max(0, changeCents))}</td>
      </tr>
    </tfoot>
  </table>

  <hr class="divider">

  <div class="footer">
    Thank you for your order!<br>
    No returns on book orders.<br>
    Questions? Contact your coordinator.
  </div>
  <div class="thank-you">— AFEON Books —</div>
</div>
<script>
  window.onload = function() {
    window.print();
    setTimeout(function() { window.close(); }, 1000);
  };
</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=380,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function POSCheckout() {
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<POSOrderData | null>(loadPOSOrder);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [step, setStep] = useState<POSStep>(stepFromLocation);
  const [cashCents, setCashCents] = useState(0);

  const goTo = (s: POSStep) => {
    window.location.hash = s;
    setStep(s);
  };

  useEffect(() => {
    // Ensure step reflects explicit query param when the page loads
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    if (stepParam === "signature" || stepParam === "done") setStep(stepParam);
    else if (stepParam === "payment") setStep("payment");

    // If no order in session, try to load by query `orderId` on mount
    if (!order) {
      const orderId = params.get("orderId");
      if (orderId) {
        setLoadingOrder(true);
        fetch(`/api/orders/${orderId}`)
          .then(async (res) => {
            if (!res.ok) throw new Error("Order not found");
            return res.json();
          })
          .then((data) => {
            const items = (data.items ?? []).map((item: any) => ({
              name: item.productName || item.name || "Item",
              qty: item.quantity || item.qty || 1,
              priceCents: item.unitPriceCents || item.priceCents || 0,
            }));
            const loadedOrder: POSOrderData = {
              alertId: data.id ? String(data.id) : `order-${orderId}`,
              orderId,
              title: `Order #${orderId}`,
              customerName: data.customerName || "Customer",
              items,
              totalCents: data.totalCents || 0,
            };
            savePOSOrder(loadedOrder);
            setOrder(loadedOrder);
          })
          .catch(() => {})
          .finally(() => setLoadingOrder(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => setStep(stepFromLocation());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const handleComplete = () => {
    if (order) {
      navigate(`/admin?completed=${order.alertId}`);
    } else {
      navigate("/admin");
    }
  };

  if (!order) {
    return (
      <Shell step="payment" onBack={() => navigate("/admin")}>
        <div className="text-center py-20">
          <p className="text-sm text-black/40 font-medium">No order selected.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  const changeCents = cashCents - order.totalCents;

  return (
    <Shell
      step={step}
      onBack={step === "payment" ? () => navigate("/admin") : () => goTo("payment")}
    >
      {step === "payment" && (
        <PaymentStep
          order={order}
          onNext={(paid) => {
            setCashCents(paid);
            goTo("signature");
          }}
          onBack={() => navigate("/admin")}
        />
      )}
      {step === "signature" && (
        <SignatureStep
          order={order}
          onNext={() => goTo("done")}
          onBack={() => goTo("payment")}
        />
      )}
      {step === "done" && (
        <DoneStep
          order={order}
          cashCents={cashCents}
          changeCents={changeCents}
          onPrint={() => printReceipt(order, cashCents, changeCents)}
          onComplete={handleComplete}
        />
      )}
    </Shell>
  );
}

function Shell({
  step,
  onBack,
  children,
}: {
  step: POSStep;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const subtitle =
    step === "payment" ? "Payment" : step === "signature" ? "Signature" : "Complete";
  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]">
      <header className="h-14 px-5 flex items-center justify-between border-b border-black/10 bg-[#FAF7F2]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-black/50 hover:text-black transition-colors p-1"
            aria-label="Back"
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
          </button>
          <img
            src="/afeonbooks-logo.png"
            alt="AFEON Books"
            className="h-7 w-7 rounded-full object-cover"
          />
          <div className="leading-none">
            <p className="text-sm font-bold text-black">POS Checkout</p>
            <p className="text-[11px] text-black/40 font-medium">{subtitle}</p>
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
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

function PaymentStep({
  order,
  onNext,
  onBack,
}: {
  order: POSOrderData;
  onNext: (cashCents: number) => void;
  onBack: () => void;
}) {
  const [cashInput, setCashInput] = useState("");

  const cashCents = cashInput.trim()
    ? Math.round(parseFloat(cashInput.replace(/[^0-9.]/g, "") || "0") * 100)
    : 0;
  const changeCents = cashCents - order.totalCents;
  const short = changeCents < 0 && cashCents > 0;
  const canComplete = cashCents >= order.totalCents;

  const setQuick = (dollars: number) => setCashInput(dollars.toFixed(2));
  const setExact = () => setCashInput((order.totalCents / 100).toFixed(2));

  return (
    <div className="flex flex-col gap-3">
      {/* Order summary */}
      <div className="border border-black/12 bg-white px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-black mb-3">
          {order.customerName || "Customer"}
        </p>
        <div className="flex flex-col gap-1.5 mb-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-black font-medium leading-snug">
                {item.qty > 1 ? `${item.qty}× ` : ""}
                {item.name}
              </span>
              <span className="text-sm font-medium text-black shrink-0">
                {item.priceCents > 0 ? formatCents(item.priceCents * item.qty) : ""}
              </span>
            </div>
          ))}
          {order.items.length === 0 && <p className="text-sm text-black/40">No items</p>}
        </div>
        <div className="border-t border-black/10 pt-3 flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-black/60">
            Total Due
          </span>
          <span className="text-3xl font-bold text-black">{formatCents(order.totalCents)}</span>
        </div>
      </div>

      {/* Cash received */}
      <div className="border border-black/12 bg-white px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/50 mb-3">
          Cash Received
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setQuick(amt)}
              className={`border px-3 py-3 text-sm font-medium transition-colors ${
                cashInput === amt.toFixed(2)
                  ? "border-black bg-black text-white"
                  : "border-black/20 bg-white text-black hover:border-black/40"
              }`}
            >
              ${amt}.00
            </button>
          ))}
          <button
            onClick={setExact}
            className={`border px-3 py-3 text-sm font-medium transition-colors ${
              cashInput === (order.totalCents / 100).toFixed(2) && cashInput !== ""
                ? "border-black bg-black text-white"
                : "border-black/20 bg-white text-black hover:border-black/40"
            }`}
          >
            Exact
          </button>
        </div>
        <div className="flex items-center border border-black/20">
          <span className="pl-3 text-sm font-medium text-black/40">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value)}
            placeholder="0.00"
            className="flex-1 px-2 py-3 text-sm font-medium text-black bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Change due */}
      <div
        className={`border px-5 py-5 text-center transition-colors ${
          short ? "border-red-200 bg-red-50" : "border-black/12 bg-white"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/50 mb-3">
          Change Due
        </p>
        {cashCents === 0 ? (
          <div className="w-8 h-0.5 mx-auto bg-black/20" />
        ) : short ? (
          <>
            <p className="text-3xl font-bold text-red-600 mb-1">
              -{formatCents(Math.abs(changeCents))}
            </p>
            <p className="text-xs font-medium text-red-500">
              Short by {formatCents(Math.abs(changeCents))}
            </p>
          </>
        ) : (
          <p className="text-3xl font-bold text-black">{formatCents(changeCents)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-0 border border-black/15 overflow-hidden mt-1">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-4 text-xs font-bold uppercase tracking-widest text-black/60 bg-white hover:bg-black/5 transition-colors flex items-center justify-center gap-2 border-r border-black/15"
        >
          <span className="text-base leading-none">✕</span> Back
        </button>
        <button
          onClick={() => onNext(cashCents)}
          disabled={!canComplete}
          className="flex-[2] px-4 py-4 text-xs font-bold uppercase tracking-widest text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">✓</span> Complete Sale
        </button>
      </div>
    </div>
  );
}

function SignatureStep({
  order,
  onNext,
  onBack,
}: {
  order: POSOrderData;
  onNext: () => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return {
        x: (t.clientX - rect.left) * scaleX,
        y: (t.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      lastPos.current = getPos(e, canvas);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!drawing.current || !lastPos.current) return;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
      setHasSig(true);
    };
    const stop = () => {
      drawing.current = false;
      lastPos.current = null;
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", stop);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", stop);
      canvas.removeEventListener("mouseleave", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", stop);
    };
  }, []);

  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-black/12 bg-white px-5 py-4">
        <p className="text-xs font-bold text-black/60 mb-1">
          {order.customerName
            ? `Please have ${order.customerName} sign below.`
            : "Please have the customer sign below."}
        </p>
        <p className="text-xs text-black/30 mb-4">Total: {formatCents(order.totalCents)}</p>
        <div className="relative border border-black/15 bg-white select-none touch-none">
          <canvas
            ref={canvasRef}
            width={700}
            height={220}
            className="w-full cursor-crosshair block"
            style={{ height: "180px" }}
          />
          <div className="absolute bottom-6 left-4 right-4 border-t border-dashed border-black/15 pointer-events-none" />
          {!hasSig && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-black/25 font-medium pointer-events-none pb-4">
              Sign here
            </p>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={clearSig}
            className="text-[10px] font-bold uppercase tracking-widest text-black/30 hover:text-black transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex gap-0 border border-black/15 overflow-hidden">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-4 text-xs font-bold uppercase tracking-widest text-black/60 bg-white hover:bg-black/5 transition-colors flex items-center justify-center gap-2 border-r border-black/15"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!hasSig}
          className="flex-[2] px-4 py-4 text-xs font-bold uppercase tracking-widest text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          ✓ Done — Hand Off Order
        </button>
      </div>
    </div>
  );
}

function DoneStep({
  order,
  cashCents,
  changeCents,
  onPrint,
  onComplete,
}: {
  order: POSOrderData;
  cashCents: number;
  changeCents: number;
  onPrint: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="border border-black/12 bg-white px-8 py-12 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path
            d="M6 16L13 23L26 10"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-2">
        Order Complete
      </p>
      <h2 className="text-2xl font-bold text-black mb-3">
        {order.customerName
          ? `Thank you, ${order.customerName.split(" ")[0]}!`
          : "Thank you!"}
      </h2>

      {/* Payment summary */}
      <div className="w-full border border-black/10 divide-y divide-black/8 mb-8 text-left">
        <div className="px-4 py-2.5 flex justify-between text-sm">
          <span className="text-black/50 font-medium">Total</span>
          <span className="font-bold text-black">{formatCents(order.totalCents)}</span>
        </div>
        <div className="px-4 py-2.5 flex justify-between text-sm">
          <span className="text-black/50 font-medium">Cash Received</span>
          <span className="font-medium text-black">{formatCents(cashCents)}</span>
        </div>
        <div className="px-4 py-2.5 flex justify-between text-sm">
          <span className="text-black/50 font-medium">Change Given</span>
          <span className="font-medium text-black">
            {formatCents(Math.max(0, changeCents))}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <button
        onClick={onPrint}
        className="w-full mb-3 border border-black/20 bg-white hover:bg-black/5 text-black px-8 py-3.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path
            d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Print Receipt
      </button>

      <button
        onClick={onComplete}
        className="w-full bg-black hover:bg-amber-800 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs transition-colors"
      >
        Back to Queue
      </button>
    </div>
  );
}
