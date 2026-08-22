import { useEffect, useMemo, useRef, useState } from "react";
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
  Package,
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
  walkInPreorder?: boolean;
}

type Phase = "lookup" | "walkin-form" | "cart" | "payment" | "signature" | "done";

const CASH_PRESETS = [500, 1000, 2000, 5000, 10000];

function isPinAuthed() {
  return sessionStorage.getItem("adminAuthed") === "0";
}

export default function Pos() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // ── PIN AUTH ──
  const [authed, setAuthed] = useState(isPinAuthed);
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
        setTimeout(() => { setPinShake(false); pinRefs[0].current?.focus(); }, 600);
      }
    } catch { setPinError("Connection error."); }
    finally { setPinLoading(false); }
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

  // ── DATA ──
  const { data: orders } = useListOrders();
  const { data: products } = useListProducts();
  const updateStatus = useUpdateOrderStatus();
  const createOrder = useCreateOrder();

  const activeProducts = useMemo(() => (products ?? []).filter((p) => p.active), [products]);

  // ── POS STATE ──
  const [phase, setPhase] = useState<Phase>("lookup");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<CustomerInfo>({ name: "", studentId: "", classroom: "", email: "" });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [walkin, setWalkin] = useState({ name: "", studentId: "", classroom: "", email: "", preorder: false });
  const [addProductId, setAddProductId] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [cashCents, setCashCents] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const queryLoadedRef = useRef(false);

  useEffect(() => {
    if (queryLoadedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const orderIdParam = params.get("orderId");
    if (!orderIdParam || !orders) return;

    const orderId = Number(orderIdParam);
    if (Number.isNaN(orderId)) return;

    const targetOrder = orders.find((it) => it.id === orderId);
    if (!targetOrder) return;

    loadOrderIntoCart(targetOrder);
    const stepParam = params.get("step");
    if (stepParam === "signature") {
      setPhase("signature");
    } else if (stepParam === "payment") {
      setPhase("payment");
    } else {
      setPhase("cart");
    }
    queryLoadedRef.current = true;
  }, [orders]);

  // ── SCANNER ──
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [lastScanDisplay, setLastScanDisplay] = useState(""); // only for UI feedback
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanActiveRef = useRef(false);
  const lastScanRef = useRef(""); // ref so scan loop always reads fresh value
  const activeProductsRef = useRef(activeProducts); // ref so scan loop always reads fresh products

  // Keep refs in sync with latest state/memos
  useEffect(() => { activeProductsRef.current = activeProducts; }, [activeProducts]);

  useEffect(() => { setScannerSupported("BarcodeDetector" in window); }, []);
  useEffect(() => () => stopScanner(), []);

  // ── CART ──
  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0), [cart]);
  const changeCents = cashCents - cartTotal;

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

  function loadOrderIntoCart(order: NonNullable<typeof orders>[number]) {
    setCustomer({
      name: order.customerName,
      studentId: order.customerPhone ?? "",
      classroom: order.classroom ?? "",
      email: order.customerEmail ?? "",
      preorderId: order.id,
      walkInPreorder: order.orderType === "preorder",
    });
    setCart(order.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
    })));
    setCashCents(0);
    setSaleComplete(false);
    setPhase("cart");
  }

  function addToCartById(productId: number) {
    const p = activeProductsRef.current.find((x) => x.id === productId);
    if (!p) { toast.error("Product not found"); return; }
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === productId);
      if (existing) return prev.map((it) => it.productId === productId ? { ...it, quantity: it.quantity + 1 } : it);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPriceCents: p.priceCents }];
    });
    toast.success(`Added: ${p.name}`);
  }

  function adjustQty(productId: number, delta: number) {
    setCart((prev) =>
      prev.map((it) => it.productId === productId ? { ...it, quantity: it.quantity + delta } : it)
          .filter((it) => it.quantity > 0)
    );
  }

  // ── BARCODE ──
  // Uses refs so the running scan loop always calls the up-to-date handler
  function handleBarcodeValue(raw: string) {
    if (!raw.trim()) return;
    // Duplicate suppression via ref (not state) so the running loop always sees the fresh value
    if (raw === lastScanRef.current) return;
    lastScanRef.current = raw;
    setLastScanDisplay(raw);
    setTimeout(() => { lastScanRef.current = ""; setLastScanDisplay(""); }, 2500);

    const asNum = parseInt(raw, 10);
    const prods = activeProductsRef.current;
    let matched = prods.find((p) => p.id === asNum);
    if (!matched) matched = prods.find((p) => p.name.toLowerCase().includes(raw.toLowerCase()));
    if (matched) {
      addToCartById(matched.id);
    } else {
      toast.error(`No product matched: "${raw}"`);
    }
  }

  // Store handler in ref so the async scan loop always calls the latest version
  const handleBarcodeRef = useRef(handleBarcodeValue);
  useEffect(() => { handleBarcodeRef.current = handleBarcodeValue; });

  async function startScanner() {
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

      const loop = async () => {
        if (!scanActiveRef.current || !videoRef.current) return;
        try {
          const barcodes: { rawValue: string }[] = await detector.detect(videoRef.current);
          if (barcodes.length > 0) handleBarcodeRef.current(barcodes[0].rawValue);
        } catch { /* frame not ready yet, ignore */ }
        if (scanActiveRef.current) setTimeout(loop, 350);
      };
      loop();
    } catch (e: unknown) {
      toast.error(`Camera error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function stopScanner() {
    scanActiveRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScannerActive(false);
  }

  function submitManualBarcode() {
    const v = manualBarcode.trim();
    if (!v) return;
    handleBarcodeRef.current(v);
    setManualBarcode("");
  }

  // ── CHECKOUT ──
  async function completeSale() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!customer.walkInPreorder && cashCents < cartTotal) { toast.error("Cash received is less than total"); return; }
    setCompleting(true);
    try {
      if (customer.preorderId) {
        // Mark existing preorder as confirmed
        await new Promise<void>((resolve, reject) =>
          updateStatus.mutate(
            { id: customer.preorderId!, data: { status: "confirmed" } },
            { onSuccess: () => resolve(), onError: reject }
          )
        );
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      } else {
        // Create a new walk-in order
        const classroom = customer.classroom || "POS";
        const email = customer.email || "pos@afeonbooks.com";
        await new Promise<void>((resolve, reject) =>
          createOrder.mutate(
            {
              data: {
                school: "alvarado",
                customerName: customer.name,
                customerEmail: email,
                customerPhone: customer.studentId || "pos-walkin",
                useDefaultAddress: true,
                classroom,
                items: cart.map((it) => ({ productId: it.productId, quantity: it.quantity })),
                orderType: customer.walkInPreorder ? "preorder" : "sale",
                utmSource: "pos",
                utmMedium: "in-person",
              },
            },
            {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            }
          )
        );
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      }
      setSaleComplete(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Sale failed: ${msg}. Check that the default shipping address is configured in Site Content.`);
      throw e;
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
    setLastScanDisplay("");
    lastScanRef.current = "";
    setManualBarcode("");
    setAddProductId("");
  }

  // ── PIN SCREEN ──
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
          <div className="flex justify-center gap-4 mb-6" style={pinShake ? { animation: "shake 0.5s ease-in-out" } : {}}>
            {pinDigits.map((d, i) => (
              <input key={i} ref={pinRefs[i]} type="tel" inputMode="numeric" maxLength={1} value={d}
                autoFocus={i === 0} disabled={pinLoading}
                onChange={(e) => handlePinInput(i, e.target.value)}
                onKeyDown={(e) => handlePinKey(i, e)}
                className="w-14 h-16 text-center text-2xl font-bold border-2 border-black/20 bg-white focus:border-black focus:outline-none rounded-none transition-colors disabled:opacity-50"
              />
            ))}
          </div>
          {pinError && <p className="text-center text-red-600 text-sm mb-4">{pinError}</p>}
          <button onClick={() => submitPin(pinDigits)} disabled={pinLoading || pinDigits.join("").length !== 4}
            className="w-full bg-black text-white py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-40">
            {pinLoading ? "Verifying..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  // ── HEADER ──
  const phaseLabel =
    phase === "lookup" ? "Select preorder or walk-in"
    : phase === "walkin-form" ? "Walk-in customer"
    : phase === "cart" ? `${customer.name}${customer.preorderId ? ` · Preorder #${customer.preorderId}` : " · Walk-in"}`
    : phase === "signature" ? "Signature"
    : phase === "done" ? "Complete"
    : "Payment";

  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans flex flex-col">
      {/* Sticky header */}
      <header className="bg-white border-b border-black/10 sticky top-0 z-50 px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {phase !== "lookup" && !saleComplete && (
              <button onClick={() => {
                if (phase === "payment") { setPhase("cart"); setCashCents(0); }
                else if (phase === "cart") { stopScanner(); setPhase("lookup"); }
                else if (phase === "walkin-form") setPhase("lookup");
              }} className="p-2 hover:bg-black/5 rounded shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <img src={xlogo} alt="" className="w-7 h-7 object-contain shrink-0" draggable={false} />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">POS Checkout</p>
              <p className="text-xs text-black/40 truncate">{phaseLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phase === "cart" && cart.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold bg-black text-white px-2.5 py-1.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                {formatPrice(cartTotal, "USD")}
              </span>
            )}
            <button onClick={() => navigate("/", { replace: true })}
              className="text-xs text-black/40 hover:text-black uppercase tracking-widest font-bold px-2 py-1">
              ← Admin
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">

        {/* ── LOOKUP ── */}
        {phase === "lookup" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 pointer-events-none" />
                <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, student ID, classroom, or order #"
                  className="pl-9 rounded-none h-11" />
              </div>
              <Button onClick={() => { setWalkin({ name: "", studentId: "", classroom: "", email: "", preorder: false }); setPhase("walkin-form"); }}
                className="rounded-none h-11 bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold px-4 gap-1.5 shrink-0">
                <UserPlus className="w-4 h-4" />
                Walk-in
              </Button>
            </div>

            <div className="bg-white border border-black/5 shadow-sm divide-y divide-black/5">
              {filteredOrders.length === 0 ? (
                <p className="py-12 text-center text-black/40 text-sm">
                  {search ? `No orders matching "${search}"` : "No orders found."}
                </p>
              ) : filteredOrders.map((order) => (
                <button key={order.id} onClick={() => loadOrderIntoCart(order)}
                  className="w-full text-left px-4 py-3.5 hover:bg-black/[0.02] transition-colors flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm">{order.customerName}</span>
                       {order.orderType === "preorder" && (
                         <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-blue-100 text-blue-700">preorder · due later</span>
                       )}
                       <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${
                        order.status === "confirmed" ? "bg-blue-100 text-blue-700"
                        : order.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                        : order.status === "pending" ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"}`}>{order.status}</span>
                    </div>
                    <div className="text-xs text-black/40 flex flex-wrap gap-x-2.5 gap-y-0.5">
                      <span>#{order.id}</span>
                      {order.customerPhone && <span>{order.customerPhone}</span>}
                      {order.classroom && <span>Room {order.classroom}</span>}
                      <span className="text-black/50">{order.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm">{formatPrice(order.totalCents, order.currency)}</span>
                    <ChevronRight className="w-4 h-4 text-black/20 group-hover:text-black/60 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── WALK-IN FORM ── */}
        {phase === "walkin-form" && (
          <div className="max-w-md mx-auto">
            <div className="bg-white border border-black/5 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-lg">Walk-in Customer</h2>
              {[
                { label: "Full Name *", key: "name", placeholder: "Student or customer name", type: "text" },
                { label: "Student ID *", key: "studentId", placeholder: "e.g. s100...", type: "text" },
                { label: "Classroom", key: "classroom", placeholder: "e.g. A3", type: "text" },
                { label: "Email (optional)", key: "email", placeholder: "for receipt", type: "email" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-xs font-bold uppercase tracking-widest text-black/50 block mb-1">{label}</label>
                  <Input type={type} value={String(walkin[key as keyof typeof walkin] ?? "")}
                    onChange={(e) => setWalkin((p) => ({ ...p, [key]: e.target.value }))}
                    className="rounded-none" placeholder={placeholder}
                    autoFocus={key === "name"}
                    onKeyDown={(e) => { if (e.key === "Enter" && key === "studentId") {
                      if (!walkin.name.trim()) { toast.error("Name is required"); return; }
                      if (!walkin.studentId.trim()) { toast.error("Student ID is required"); return; }
                    }}}
                  />
                </div>
              ))}
              <label className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={walkin.preorder}
                  onChange={(e) => setWalkin((p) => ({ ...p, preorder: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-bold text-blue-900">Walk-in preorder</span>
                  <span className="block text-xs text-blue-700 mt-0.5">Reserve these items now. No money is due yet.</span>
                </span>
              </label>
              <Button onClick={() => {
                if (!walkin.name.trim()) { toast.error("Name is required"); return; }
                if (!walkin.studentId.trim()) { toast.error("Student ID is required"); return; }
                setCustomer({ name: walkin.name.trim(), studentId: walkin.studentId.trim(), classroom: walkin.classroom.trim(), email: walkin.email.trim(), walkInPreorder: walkin.preorder });
                setCart([]);
                setCashCents(0);
                setSaleComplete(false);
                setPhase("cart");
              }} className="w-full rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold h-11">
                Continue to Cart →
              </Button>
            </div>
          </div>
        )}

        {/* ── CART ── */}
        {phase === "cart" && (
          <div className="space-y-4">
            {/* Cart items */}
            <div className="bg-white border border-black/5 shadow-sm">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <h2 className="font-bold text-xs uppercase tracking-widest text-black/50">Cart</h2>
                {customer.preorderId
                  ? <span className="text-xs text-blue-600 font-medium">Preorder #{customer.preorderId}</span>
                  : <span className="text-xs text-amber-600 font-medium">Walk-in</span>}
              </div>
              {cart.length === 0 ? (
                <p className="py-10 text-center text-sm text-black/40">Cart is empty — add a product below</p>
              ) : (
                <div className="divide-y divide-black/5">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
                      <Package className="w-4 h-4 text-black/20 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-black/40">{formatPrice(item.unitPriceCents, "USD")} ea</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => adjustQty(item.productId, -1)}
                          className="w-7 h-7 flex items-center justify-center border border-black/20 hover:bg-black/5">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
                        <button onClick={() => adjustQty(item.productId, 1)}
                          className="w-7 h-7 flex items-center justify-center border border-black/20 hover:bg-black/5">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="w-14 text-right font-bold text-sm tabular-nums shrink-0">
                        {formatPrice(item.unitPriceCents * item.quantity, "USD")}
                      </span>
                      <button onClick={() => setCart((p) => p.filter((i) => i.productId !== item.productId))}
                        className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {cart.length > 0 && (
                <div className="px-4 py-3 border-t border-black/10 flex items-center justify-between bg-black/[0.01]">
                  <span className="text-xs font-bold uppercase tracking-widest text-black/50">Subtotal</span>
                  <span className="font-bold text-lg tabular-nums">{formatPrice(cartTotal, "USD")}</span>
                </div>
              )}
            </div>

            {/* Add product */}
            <div className="bg-white border border-black/5 shadow-sm p-4 space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-widest text-black/50">Add Product</h3>
              <div className="flex gap-2">
                <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)}
                  className="flex-1 border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black rounded-none bg-white">
                  <option value="">Choose a product…</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} — {formatPrice(p.priceCents, p.currency)} ({p.stock} left)
                    </option>
                  ))}
                </select>
                <Button onClick={() => { if (addProductId) { addToCartById(parseInt(addProductId)); setAddProductId(""); } }}
                  disabled={!addProductId}
                  className="rounded-none bg-black text-white hover:bg-black/80 h-10 px-4">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Barcode scanner */}
            <div className="bg-white border border-black/5 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-widest text-black/50">Barcode Scanner</h3>
                {scannerSupported ? (
                  <button onClick={scannerActive ? stopScanner : startScanner}
                    className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 transition-colors ${
                      scannerActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-black text-white hover:bg-black/80"}`}>
                    {scannerActive ? <><CameraOff className="w-3.5 h-3.5" />Stop</> : <><Camera className="w-3.5 h-3.5" />Start Camera</>}
                  </button>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">Use text entry below</span>
                )}
              </div>

              {/* Camera preview */}
              {scannerSupported && (
                <div className={`relative bg-black overflow-hidden transition-all duration-200 ${scannerActive ? "h-44" : "h-0"}`}>
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white/60 w-48 h-28 rounded-sm" />
                  </div>
                  {lastScanDisplay && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-sm">
                        ✓ {lastScanDisplay}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Manual barcode entry */}
              <div className="flex gap-2">
                <Input value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitManualBarcode(); }}
                  placeholder="Type or scan barcode / product ID, then Enter"
                  className="rounded-none text-sm h-9 flex-1" />
                <Button onClick={submitManualBarcode} className="rounded-none h-9 px-3 bg-black text-white hover:bg-black/80">
                  <Check className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-black/30">Barcode value should be the product ID (number) or part of the product name</p>
            </div>

            {/* Customer card + proceed */}
            <div className="bg-white border border-black/5 shadow-sm p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Customer</p>
                <p className="font-semibold text-sm">{customer.name}</p>
                <div className="text-xs text-black/40 mt-0.5 space-y-0.5">
                  {customer.studentId && <p>ID: {customer.studentId}</p>}
                  {customer.classroom && <p>Room: {customer.classroom}</p>}
                </div>
              </div>
               <Button onClick={() => {
                 if (cart.length === 0) { toast.error("Add at least one item first"); return; }
                 setCashCents(0);
                 if (customer.walkInPreorder) {
                   void completeSale().then(() => setPhase("done")).catch(() => undefined);
                 } else {
                   setPhase("payment");
                 }
               }} disabled={cart.length === 0 || completing}
                className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold h-11 px-5 gap-2 shrink-0">
                 {completing ? "Saving…" : customer.walkInPreorder ? "Save Preorder" : "Payment"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── PAYMENT ── */}
        {phase === "payment" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white border border-black/5 shadow-sm">
              <div className="px-4 py-3 border-b border-black/5">
                <p className="text-xs font-bold uppercase tracking-widest text-black/40">{customer.name}</p>
              </div>
              <div className="divide-y divide-black/5 px-4">
                {cart.map((it) => (
                  <div key={it.productId} className="flex justify-between py-2.5 text-sm">
                    <span className="text-black/70">{it.quantity}× {it.productName}</span>
                    <span className="font-medium tabular-nums">{formatPrice(it.unitPriceCents * it.quantity, "USD")}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-4 border-t border-black/10 flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-widest">Total Due</span>
                <span className="text-3xl font-bold tabular-nums">{formatPrice(cartTotal, "USD")}</span>
              </div>
            </div>

            <div className="bg-white border border-black/5 shadow-sm p-4 space-y-3">
              <p className="font-bold text-xs uppercase tracking-widest text-black/50">Cash Received</p>
              <div className="grid grid-cols-3 gap-2">
                {CASH_PRESETS.map((cents) => (
                  <button key={cents} onClick={() => setCashCents(cents)}
                    className={`py-3 text-sm font-bold border transition-colors ${
                      cashCents === cents ? "bg-black text-white border-black" : "border-black/20 hover:bg-black/5"}`}>
                    {formatPrice(cents, "USD")}
                  </button>
                ))}
                <button onClick={() => setCashCents(cartTotal)}
                  className={`py-3 text-sm font-bold border transition-colors ${
                    cashCents === cartTotal && cartTotal > 0 ? "bg-black text-white border-black" : "border-black/20 hover:bg-black/5"}`}>
                  Exact
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-black/40 font-medium shrink-0">$</span>
                <Input type="number" min={0} step={0.01}
                  value={cashCents > 0 ? (cashCents / 100).toFixed(2) : ""}
                  onChange={(e) => { const v = parseFloat(e.target.value); setCashCents(isNaN(v) ? 0 : Math.round(v * 100)); }}
                  placeholder="0.00" className="rounded-none text-xl font-bold h-12 tabular-nums" />
              </div>
            </div>

            <div className={`p-5 border text-center transition-colors ${
              cashCents === 0 ? "bg-white border-black/5"
              : changeCents < 0 ? "bg-red-50 border-red-200"
              : "bg-emerald-50 border-emerald-200"}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Change Due</p>
              <p className={`text-4xl font-bold tabular-nums ${
                changeCents < 0 ? "text-red-600" : changeCents > 0 ? "text-emerald-600" : "text-black/30"}`}>
                {cashCents === 0 ? "—" : changeCents < 0 ? `-${formatPrice(-changeCents, "USD")}` : formatPrice(changeCents, "USD")}
              </p>
              {changeCents < 0 && (
                <p className="text-xs text-red-500 mt-1 font-medium">Short by {formatPrice(-changeCents, "USD")}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => { setPhase("cart"); setCashCents(0); }} variant="outline"
                className="flex-1 rounded-none h-12 border-black/20 uppercase tracking-widest text-xs font-bold gap-2">
                <X className="w-4 h-4" />Back
              </Button>
              <Button onClick={() => setPhase("signature")}
                disabled={completing || cashCents < cartTotal || cart.length === 0}
                className="flex-1 rounded-none h-12 bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest text-xs font-bold gap-2 disabled:opacity-50">
                {completing ? "Processing…" : <><Check className="w-4 h-4" />Next: Signature</>}
              </Button>
            </div>
          </div>
        )}

        {phase === "signature" && (
          <div className="max-w-md mx-auto space-y-4">
            <SignatureStep
              customer={customer}
              cart={cart}
              onNext={async (signatureDataUrl) => {
                await completeSale();
                setSignatureDataUrl(signatureDataUrl);
                setPhase("done");
              }}
              onBack={() => setPhase("payment")}
            />
          </div>
        )}

        {phase === "done" && (
          <div className="max-w-md mx-auto space-y-4">
            <DoneStep
              customer={customer}
              cart={cart}
              cashCents={cashCents}
              changeCents={changeCents}
              preorder={customer.walkInPreorder === true}
              signatureDataUrl={signatureDataUrl}
              onPrint={() => printReceipt(customer, cart, cashCents, changeCents, signatureDataUrl)}
              onComplete={resetPOS}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SignatureStep({
  customer,
  cart,
  onNext,
  onBack,
}: {
  customer: CustomerInfo;
  cart: CartItem[];
  onNext: (signatureDataUrl: string) => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const getPointer = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
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

    const start = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      drawing.current = true;
      lastPos.current = getPointer(event, canvas);
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      if (!drawing.current || !lastPos.current) return;
      const pos = getPointer(event, canvas);
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
      setHasSignature(true);
    };

    const stop = () => {
      drawing.current = false;
      lastPos.current = null;
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stop);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stop);
      canvas.removeEventListener("mouseleave", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stop);
    };
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onNext(canvas.toDataURL("image/png"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-black/12 bg-white px-5 py-4">
        <p className="text-xs font-bold text-black/60 mb-1">
          {customer.name
            ? `Please have ${customer.name} sign below.`
            : "Please have the customer sign below."}
        </p>
        <p className="text-xs text-black/30 mb-4">Total: {formatPrice(cart.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0), "USD")}</p>
        <div className="relative border border-black/15 bg-white select-none touch-none">
          <canvas
            ref={canvasRef}
            width={700}
            height={220}
            className="w-full cursor-crosshair block"
            style={{ height: "180px" }}
          />
          {!hasSignature && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-black/25 font-medium pointer-events-none pb-4">
              Sign here
            </p>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={clearSignature}
            className="text-[10px] font-bold uppercase tracking-widest text-black/30 hover:text-black transition-colors"
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex gap-0 border border-black/15 overflow-hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-4 text-xs font-bold uppercase tracking-widest text-black/60 bg-white hover:bg-black/5 transition-colors flex items-center justify-center gap-2 border-r border-black/15"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasSignature}
          className="flex-1 px-4 py-4 text-xs font-bold uppercase tracking-widest text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />Done & Print Receipt
        </button>
      </div>
    </div>
  );
}

function DoneStep({
  customer,
  cart,
  cashCents,
  changeCents,
  preorder,
  signatureDataUrl,
  onPrint,
  onComplete,
}: {
  customer: CustomerInfo;
  cart: CartItem[];
  cashCents: number;
  changeCents: number;
  preorder: boolean;
  signatureDataUrl: string | null;
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
        {customer.name ? `Thank you, ${customer.name.split(" ")[0]}!` : "Thank you!"}
      </h2>

      <div className="w-full border border-black/10 divide-y divide-black/8 mb-8 text-left">
        <div className="px-4 py-2.5 flex justify-between text-sm">
          <span className="text-black/50 font-medium">Total</span>
          <span className="font-bold text-black">{formatPrice(cart.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0), "USD")}</span>
        </div>
        {preorder ? (
          <div className="px-4 py-2.5 flex justify-between text-sm">
            <span className="text-black/50 font-medium">Payment</span>
            <span className="font-bold text-blue-700">Nothing due yet</span>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 flex justify-between text-sm">
              <span className="text-black/50 font-medium">Cash Received</span>
              <span className="font-medium text-black">{formatPrice(cashCents, "USD")}</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between text-sm">
              <span className="text-black/50 font-medium">Change Given</span>
              <span className="font-medium text-black">{formatPrice(Math.max(0, changeCents), "USD")}</span>
            </div>
          </>
        )}
      </div>

      {signatureDataUrl && (
        <div className="w-full max-w-xs border border-black/10 bg-white p-4 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-black/40 mb-2">Signature</p>
          <img src={signatureDataUrl} alt="Signature" className="w-full h-32 object-contain" />
        </div>
      )}

      <button
        type="button"
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
        type="button"
        onClick={onComplete}
        className="w-full bg-black hover:bg-amber-800 text-white px-8 py-4 font-bold uppercase tracking-widest text-xs transition-colors"
      >
        Back to Queue
      </button>
    </div>
  );
}

function printReceipt(
  customer: CustomerInfo,
  cart: CartItem[],
  cashCents: number,
  changeCents: number,
  signatureDataUrl: string | null,
) {
  const now = new Date();
  const rows = cart
    .map(
      (item) =>
        `<tr><td style="padding:4px 0;">${item.quantity}× ${item.productName}</td><td style="padding:4px 0; text-align:right;">${formatPrice(item.unitPriceCents * item.quantity, "USD")}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>AFEON Books Receipt</title>
<style>
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; padding: 24px; }
  h1 { font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 4px 0; }
  .right { text-align: right; }
  .total { font-weight: bold; }
  .signature { margin-top: 16px; border-top: 1px dashed #000; padding-top: 10px; }
  .footer { font-size: 11px; color: #555; margin-top: 14px; }
</style>
</head>
<body>
  <h1>AFEON Books</h1>
  <p>Receipt — ${customer.name || "Customer"}</p>
  <p>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
  <table>
    <tbody>
      ${rows}
      <tr><td class="total">Total</td><td class="right total">${formatPrice(cart.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0), "USD")}</td></tr>
      <tr><td>Cash</td><td class="right">${formatPrice(cashCents, "USD")}</td></tr>
      <tr><td>Change</td><td class="right">${formatPrice(Math.max(0, changeCents), "USD")}</td></tr>
    </tbody>
  </table>
  ${signatureDataUrl ? `<div class="signature"><p style="font-size:11px; margin-bottom: 8px;">Customer Signature:</p><img src="${signatureDataUrl}" alt="Signature" style="max-width:100%; height:auto; border:1px solid #000;"/></div>` : ""}
  <p class="footer">Thank you for shopping with AFEON Books.</p>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=620,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
