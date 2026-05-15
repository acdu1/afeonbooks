import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  useListOrders,
  useListProducts,
  useUpdateOrderStatus,
  useCreateOrder,
  getListOrdersQueryKey,
  getGetOrdersSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import xlogo from "@assets/logo_web.png";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

interface CustomerInfo {
  name: string;
  studentId: string;
  classroom: string;
  email: string;
  preorderId?: number;
}

type Phase = "lookup" | "walkin-form" | "cart" | "payment";

const CASH_PRESETS = [500, 1000, 2000, 5000, 10000];

function pinAuthed() {
  return sessionStorage.getItem("adminAuthed") === "1";
}

export default function Pos() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [authed, setAuthed] = useState(pinAuthed);
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [pinShake, setPinShake] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const submitPin = async (digits: string[]) => {
    const pin = digits.join("");
    if (pin.length !== 4) return;
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        sessionStorage.setItem("adminAuthed", "1");
        setAuthed(true);
      } else {
        setPinShake(true);
        setPinError(data.error ?? "Incorrect PIN.");
        setPinDigits(["", "", "", ""]);
        setTimeout(() => {
          setPinShake(false);
          pinRefs[0].current?.focus();
        }, 600);
      }
    } catch {
      setPinError("Connection error.");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
  };
  const handlePinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pinDigits];
    next[idx] = digit;
    setPinDigits(next);
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus();
    else if (digit && idx === 3) submitPin(next);
  };

  const { data: orders } = useListOrders();
  const { data: products } = useListProducts();
  const updateStatus = useUpdateOrderStatus();
  const createOrder = useCreateOrder();

  const [phase, setPhase] = useState<Phase>("lookup");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<CustomerInfo>({ name: "", studentId: "", classroom: "", email: "" });
  const [cart, setCart] = useState<CartItem[]>([]);

  const [walkinName, setWalkinName] = useState("");
  const [walkinStudentId, setWalkinStudentId] = useState("");
  const [walkinClassroom, setWalkinClassroom] = useState("");
  const [walkinEmail, setWalkinEmail] = useState("");

  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [addProductId, setAddProductId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanActiveRef = useRef(false);

  const [cashCents, setCashCents] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);

  useEffect(() => {
    setScannerSupported("BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone ?? "").toLowerCase().includes(q) ||
        (o.classroom ?? "").toLowerCase().includes(q) ||
        String(o.id).includes(q)
    );
  }, [orders, search]);

  const activeProducts = useMemo(() => (products ?? []).filter((p) => p.active), [products]);

  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0), [cart]);
  const changeCents = cashCents - cartTotal;

  function loadOrderIntoCart(order: (typeof orders)[0]) {
    setCustomer({
      name: order.customerName,
      studentId: order.customerPhone ?? "",
      classroom: order.classroom ?? "",
      email: order.customerEmail ?? "",
      preorderId: order.id,
    });
    setCart(
      order.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
      }))
    );
    setPhase("cart");
  }

  function startWalkin() {
    setWalkinName("");
    setWalkinStudentId("");
    setWalkinClassroom("");
    setWalkinEmail("");
    setPhase("walkin-form");
  }

  function confirmWalkin() {
    if (!walkinName.trim()) { toast.error("Name is required"); return; }
    if (!walkinStudentId.trim()) { toast.error("Student ID is required"); return; }
    setCustomer({ name: walkinName.trim(), studentId: walkinStudentId.trim(), classroom: walkinClassroom.trim(), email: walkinEmail.trim() });
    setCart([]);
    setPhase("cart");
  }

  function addToCart(productId: number) {
    const p = activeProducts.find((x) => x.id === productId);
    if (!p) { toast.error("Product not found"); return; }
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === productId);
      if (existing) {
        return prev.map((it) =>
          it.productId === productId ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPriceCents: p.priceCents }];
    });
    toast.success(`Added: ${p.name}`);
  }

  function setQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((it) => (it.productId === productId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  }

  function handleBarcodeDetected(raw: string) {
    if (raw === lastScan) return;
    setLastScan(raw);
    setTimeout(() => setLastScan(""), 2000);
    const asNum = parseInt(raw, 10);
    let matched = activeProducts.find((p) => p.id === asNum);
    if (!matched) matched = activeProducts.find((p) => p.name.toLowerCase().includes(raw.toLowerCase()));
    if (matched) {
      addToCart(matched.id);
    } else {
      toast.error(`No product matched barcode: ${raw}`);
    }
  }

  const startScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScannerActive(true);
      scanActiveRef.current = true;

      const detector = new (window as any).BarcodeDetector({
        formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "code_39", "code_93"],
      });

      const scan = async () => {
        if (!scanActiveRef.current || !videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) handleBarcodeDetected(barcodes[0].rawValue as string);
        } catch {}
        if (scanActiveRef.current) setTimeout(scan, 400);
      };
      scan();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Camera error";
      toast.error(`Camera: ${msg}`);
    }
  }, [activeProducts, lastScan]);

  function stopScanner() {
    scanActiveRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScannerActive(false);
  }

  function submitManualBarcode() {
    if (!manualBarcode.trim()) return;
    handleBarcodeDetected(manualBarcode.trim());
    setManualBarcode("");
  }

  async function completeSale() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (cashCents < cartTotal) { toast.error("Cash received is less than total"); return; }
    setCompleting(true);
    try {
      if (customer.preorderId) {
        await new Promise<void>((resolve, reject) => {
          updateStatus.mutate(
            { id: customer.preorderId!, data: { status: "confirmed" } },
            {
              onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }); qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() }); resolve(); },
              onError: reject,
            }
          );
        });
      } else {
        const classroom = customer.classroom || "POS";
        const email = customer.email || "pos@afeonbooks.com";
        await new Promise<void>((resolve, reject) => {
          createOrder.mutate(
            {
              data: {
                customerName: customer.name,
                customerEmail: email,
                customerPhone: customer.studentId,
                useDefaultAddress: true,
                classroom,
                items: cart.map((it) => ({ productId: it.productId, quantity: it.quantity })),
                utmSource: "pos",
                utmMedium: "in-person",
              },
            },
            {
              onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }); qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() }); resolve(); },
              onError: reject,
            }
          );
        });
      }
      setSaleComplete(true);
    } catch {
      toast.error("Failed to complete sale. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  function resetPOS() {
    stopScanner();
    setPhase("lookup");
    setSearch("");
    setCart([]);
    setCustomer({ name: "", studentId: "", classroom: "", email: "" });
    setCashCents(0);
    setSaleComplete(false);
    setLastScan("");
    setManualBarcode("");
    setAddProductId("");
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center px-6">
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <img src={xlogo} alt="" className="w-12 h-12 object-contain mx-auto mb-6" draggable={false} />
            <h1 className="text-2xl font-bold tracking-tight">POS Access</h1>
            <p className="text-black/50 text-sm mt-2">Enter your 4-digit PIN</p>
          </div>
          <div className={`flex justify-center gap-4 mb-6`} style={pinShake ? { animation: "shake 0.5s ease-in-out" } : {}}>
            {pinDigits.map((d, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                autoFocus={i === 0}
                disabled={pinLoading}
                onChange={(e) => handlePinInput(i, e.target.value)}
                onKeyDown={(e) => handlePinKey(i, e)}
                className="w-14 h-16 text-center text-2xl font-bold border-2 border-black/20 bg-white focus:border-black focus:outline-none rounded-none transition-colors disabled:opacity-50"
              />
            ))}
          </div>
          {pinError && <p className="text-center text-red-600 text-sm mb-4">{pinError}</p>}
          <button
            onClick={() => submitPin(pinDigits)}
            disabled={pinLoading || pinDigits.join("").length !== 4}
            className="w-full bg-black text-white py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-40"
          >
            {pinLoading ? "Verifying..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans">
      <header className="bg-white border-b border-black/10 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {phase !== "lookup" && !saleComplete && (
              <button
                onClick={() => {
                  if (phase === "payment") { setPhase("cart"); setCashCents(0); return; }
                  if (phase === "cart") { stopScanner(); setPhase("lookup"); return; }
                  if (phase === "walkin-form") { setPhase("lookup"); return; }
                }}
                className="p-2 hover:bg-black/5 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <img src={xlogo} alt="" className="w-8 h-8 object-contain" draggable={false} />
            <div>
              <h1 className="font-bold text-base leading-tight">POS Checkout</h1>
              <p className="text-xs text-black/40">
                {phase === "lookup" ? "Select preorder or walk-in"
                  : phase === "walkin-form" ? "Walk-in customer"
                  : phase === "cart" ? `${customer.name} · ${cart.length} item${cart.length !== 1 ? "s" : ""}`
                  : "Payment"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === "cart" && cart.length > 0 && (
              <div className="flex items-center gap-1 text-sm font-bold bg-black text-white px-3 py-1.5">
                <ShoppingCart className="w-4 h-4" />
                {formatPrice(cartTotal, "USD")}
              </div>
            )}
            <button
              onClick={() => navigate("/", { replace: true })}
              className="text-xs text-black/40 hover:text-black transition-colors uppercase tracking-widest font-bold px-3 py-1.5"
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── PHASE 1: ORDER LOOKUP ── */}
        {phase === "lookup" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, student ID, classroom, or order #"
                  className="pl-9 rounded-none h-12 text-base"
                />
              </div>
              <Button
                onClick={startWalkin}
                className="rounded-none h-12 bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold px-5 gap-2 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Walk-in
              </Button>
            </div>

            <div className="bg-white border border-black/5 shadow-sm divide-y divide-black/5">
              {filteredOrders.length === 0 && (
                <div className="py-12 text-center text-black/40 text-sm">
                  {search ? `No orders matching "${search}"` : "No orders found."}
                </div>
              )}
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => loadOrderIntoCart(order)}
                  className="w-full text-left px-5 py-4 hover:bg-black/[0.02] transition-colors flex items-center gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm">{order.customerName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${
                        order.status === "confirmed" ? "bg-blue-100 text-blue-700"
                          : order.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                          : order.status === "pending" ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>{order.status}</span>
                    </div>
                    <div className="text-xs text-black/40 flex flex-wrap gap-x-3">
                      <span>#{order.id}</span>
                      {order.customerPhone && <span>{order.customerPhone}</span>}
                      {order.classroom && <span>Room {order.classroom}</span>}
                      <span className="text-black/60">{order.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-sm">{formatPrice(order.totalCents, order.currency)}</span>
                    <ChevronRight className="w-4 h-4 text-black/20 group-hover:text-black/50 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PHASE: WALK-IN FORM ── */}
        {phase === "walkin-form" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white border border-black/5 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-lg">Walk-in Customer</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-black/50 block mb-1">Full Name *</label>
                  <Input autoFocus value={walkinName} onChange={(e) => setWalkinName(e.target.value)} className="rounded-none" placeholder="Student or customer name" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-black/50 block mb-1">Student ID *</label>
                  <Input value={walkinStudentId} onChange={(e) => setWalkinStudentId(e.target.value)} className="rounded-none" placeholder="e.g. s100..." />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-black/50 block mb-1">Classroom</label>
                  <Input value={walkinClassroom} onChange={(e) => setWalkinClassroom(e.target.value)} className="rounded-none" placeholder="e.g. A3" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-black/50 block mb-1">Email (optional)</label>
                  <Input type="email" value={walkinEmail} onChange={(e) => setWalkinEmail(e.target.value)} className="rounded-none" placeholder="for order receipt" />
                </div>
              </div>
              <Button
                onClick={confirmWalkin}
                className="w-full rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold h-11"
              >
                Continue to Cart
              </Button>
            </div>
          </div>
        )}

        {/* ── PHASE 2: CART ── */}
        {phase === "cart" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: Cart items */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-white border border-black/5 shadow-sm">
                <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
                  <h2 className="font-bold text-sm uppercase tracking-widest">Cart</h2>
                  {customer.preorderId && (
                    <span className="text-xs text-black/40">Preorder #{customer.preorderId}</span>
                  )}
                </div>
                {cart.length === 0 && (
                  <div className="py-10 text-center text-black/40 text-sm">Cart is empty — scan or add a product</div>
                )}
                <div className="divide-y divide-black/5">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-black/40">{formatPrice(item.unitPriceCents, "USD")} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(item.productId, -1)}
                          className="w-7 h-7 flex items-center justify-center border border-black/20 hover:bg-black/5 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                          onClick={() => setQty(item.productId, 1)}
                          className="w-7 h-7 flex items-center justify-center border border-black/20 hover:bg-black/5 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="w-16 text-right font-bold text-sm">{formatPrice(item.unitPriceCents * item.quantity, "USD")}</span>
                      <button onClick={() => removeFromCart(item.productId)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="px-5 py-4 border-t border-black/10 flex items-center justify-between">
                    <span className="font-bold text-sm uppercase tracking-widest text-black/50">Total</span>
                    <span className="font-bold text-xl">{formatPrice(cartTotal, "USD")}</span>
                  </div>
                )}
              </div>

              {/* Add product */}
              <div className="bg-white border border-black/5 shadow-sm p-4 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-widest text-black/50">Add Product</h3>
                <div className="flex gap-2">
                  <select
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    className="flex-1 border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black rounded-none"
                  >
                    <option value="">Select a product…</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} — {formatPrice(p.priceCents, p.currency)} (stock: {p.stock})
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => { if (addProductId) { addToCart(parseInt(addProductId)); setAddProductId(""); } }}
                    disabled={!addProductId}
                    className="rounded-none bg-black text-white hover:bg-black/80 h-10 px-4"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Scanner + proceed */}
            <div className="lg:col-span-2 space-y-3">
              {/* Barcode scanner */}
              <div className="bg-white border border-black/5 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-black/50">Barcode Scanner</h3>
                  {scannerSupported ? (
                    <button
                      onClick={scannerActive ? stopScanner : startScanner}
                      className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 transition-colors ${
                        scannerActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-black text-white hover:bg-black/80"
                      }`}
                    >
                      {scannerActive ? <><CameraOff className="w-3.5 h-3.5" />Stop</> : <><Camera className="w-3.5 h-3.5" />Start</>}
                    </button>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">Manual only</span>
                  )}
                </div>

                {scannerSupported && (
                  <div className={`relative bg-black overflow-hidden transition-all ${scannerActive ? "h-48" : "h-0"}`}>
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-white/60 w-48 h-28 rounded" />
                    </div>
                    {lastScan && (
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                        <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-sm">
                          ✓ {lastScan}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitManualBarcode(); }}
                    placeholder="Scan or type barcode / product ID"
                    className="rounded-none text-sm h-9"
                  />
                  <Button onClick={submitManualBarcode} className="rounded-none h-9 px-3 bg-black text-white hover:bg-black/80">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-black/30">Barcode can be the product ID number or product name</p>
              </div>

              {/* Customer info card */}
              <div className="bg-white border border-black/5 shadow-sm p-4">
                <h3 className="font-bold text-xs uppercase tracking-widest text-black/50 mb-2">Customer</h3>
                <p className="font-bold text-sm">{customer.name}</p>
                <div className="text-xs text-black/40 space-y-0.5 mt-0.5">
                  {customer.studentId && <p>ID: {customer.studentId}</p>}
                  {customer.classroom && <p>Room: {customer.classroom}</p>}
                  {customer.preorderId
                    ? <p className="text-blue-600 font-medium mt-1">Preorder #{customer.preorderId}</p>
                    : <p className="text-amber-600 font-medium mt-1">Walk-in</p>
                  }
                </div>
              </div>

              <Button
                onClick={() => { if (cart.length === 0) { toast.error("Add at least one item"); return; } setCashCents(0); setPhase("payment"); }}
                disabled={cart.length === 0}
                className="w-full rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-sm font-bold h-12 gap-2"
              >
                Continue to Payment
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── PHASE 3: PAYMENT ── */}
        {phase === "payment" && (
          <div className="max-w-lg mx-auto">
            {saleComplete ? (
              <div className="bg-white border border-black/5 shadow-sm p-10 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold">Sale Complete!</h2>
                <p className="text-black/50">
                  {changeCents > 0 ? (
                    <>Give <span className="font-bold text-black">{formatPrice(changeCents, "USD")}</span> change</>
                  ) : "Exact payment — no change"}
                </p>
                <p className="text-sm text-black/40">{customer.name} · {formatPrice(cartTotal, "USD")}</p>
                <Button onClick={resetPOS} className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold h-11 px-8 mt-2">
                  Next Customer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order summary */}
                <div className="bg-white border border-black/5 shadow-sm">
                  <div className="px-5 py-4 border-b border-black/5">
                    <p className="text-xs text-black/40 uppercase tracking-widest font-bold mb-1">Order for {customer.name}</p>
                    <div className="divide-y divide-black/5">
                      {cart.map((it) => (
                        <div key={it.productId} className="flex justify-between py-2 text-sm">
                          <span className="text-black/70">{it.quantity}× {it.productName}</span>
                          <span className="font-medium">{formatPrice(it.unitPriceCents * it.quantity, "USD")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <span className="font-bold uppercase tracking-widest text-sm">Total Due</span>
                    <span className="text-3xl font-bold">{formatPrice(cartTotal, "USD")}</span>
                  </div>
                </div>

                {/* Cash received */}
                <div className="bg-white border border-black/5 shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-widest text-black/50">Cash Received</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {CASH_PRESETS.map((cents) => (
                      <button
                        key={cents}
                        onClick={() => setCashCents(cents)}
                        className={`py-3 text-sm font-bold border transition-colors ${
                          cashCents === cents ? "bg-black text-white border-black" : "border-black/20 hover:bg-black/5"
                        }`}
                      >
                        {formatPrice(cents, "USD")}
                      </button>
                    ))}
                    <button
                      onClick={() => setCashCents(cartTotal)}
                      className={`py-3 text-sm font-bold border transition-colors ${
                        cashCents === cartTotal ? "bg-black text-white border-black" : "border-black/20 hover:bg-black/5"
                      }`}
                    >
                      Exact
                    </button>
                  </div>

                  <div className="flex gap-2 items-center">
                    <span className="text-black/50 text-sm font-medium shrink-0">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={cashCents > 0 ? (cashCents / 100).toFixed(2) : ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCashCents(isNaN(val) ? 0 : Math.round(val * 100));
                      }}
                      placeholder="0.00"
                      className="rounded-none text-lg font-bold h-12"
                    />
                  </div>
                </div>

                {/* Change */}
                <div className={`p-5 border shadow-sm text-center transition-colors ${
                  cashCents === 0 ? "bg-white border-black/5"
                    : changeCents < 0 ? "bg-red-50 border-red-200"
                    : "bg-emerald-50 border-emerald-200"
                }`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Change Due</p>
                  <p className={`text-4xl font-bold ${changeCents < 0 ? "text-red-600" : changeCents > 0 ? "text-emerald-600" : "text-black/30"}`}>
                    {cashCents === 0 ? "—" : changeCents < 0 ? `-${formatPrice(-changeCents, "USD")}` : formatPrice(changeCents, "USD")}
                  </p>
                  {changeCents < 0 && <p className="text-xs text-red-500 mt-1 font-medium">Need {formatPrice(-changeCents, "USD")} more</p>}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => { setPhase("cart"); setCashCents(0); }}
                    variant="outline"
                    className="rounded-none flex-1 h-12 border-black/20 uppercase tracking-widest text-xs font-bold gap-2"
                  >
                    <X className="w-4 h-4" />
                    Back
                  </Button>
                  <Button
                    onClick={completeSale}
                    disabled={completing || cashCents < cartTotal || cart.length === 0}
                    className="rounded-none flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest text-xs font-bold gap-2"
                  >
                    {completing ? "Processing…" : <><Check className="w-4 h-4" />Complete Sale</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
