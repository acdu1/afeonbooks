import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/format";
import { renderEmailPreview } from "@/lib/email-preview";
import { Edit2, Trash2, Send, Download } from "lucide-react";
import * as XLSX from "xlsx";
import xlogo from "@assets/logo_web.png";
import {
  useGetContent,
  useUpdateContent,
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useListOrders,
  useUpdateOrderStatus,
  useDeleteOrder,
  useSendTestEmail,
  getGetContentQueryKey,
  getListProductsQueryKey,
  getListOrdersQueryKey,
  getGetOrdersSummaryQueryKey,
} from "@workspace/api-client-react";
import type { UpdateOrderStatusStatus } from "@workspace/api-client-react";
const SCHOOL_OPTIONS = {
  alvarado: { label: "Alvarado Intermediate" },
  shelyn: { label: "Shelyn Elementary" },
} as const;

const ORDER_STATUSES: UpdateOrderStatusStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const contentSchema = z.object({
  checkoutFields: z.array(z.object({ id: z.string(), label: z.string().min(1), required: z.boolean() })).default([]),
  brandName: z.string().min(1),
  navHomeLabel: z.string().min(1),
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().min(1),
  ctaLabel: z.string().min(1),
  ctaUrl: z.string().min(1),
  coverImageUrl: z.string().url(),
  aboutHeading: z.string().min(1),
  aboutBody: z.string().min(1),
  authorsLine: z.string().min(1),
  illustratorLine: z.string().min(1),
  footerNote: z.string().min(1),
  accentColor: z.string().min(1),
  defaultShippingLabel: z.string(),
  defaultShippingAddress: z.string(),
  defaultShippingCity: z.string(),
  defaultShippingPostalCode: z.string(),
  defaultShippingCountry: z.string(),
  ordersEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  emailFromName: z.string().min(1, "From name is required"),
  emailFromAddress: z.string().email("Must be a valid email address"),
  emailReplyTo: z.string().refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Must be a valid email or empty"),
  emailSubject: z.string().min(1, "Subject is required"),
  emailHeading: z.string().min(1, "Heading is required"),
  emailIntro: z.string().min(1, "Intro is required"),
  emailButtonLabel: z.string().min(1, "Button label is required"),
  emailFooter: z.string(),
  emailAccentColor: z.string().min(1),
});

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  priceDollars: z.coerce.number().min(0.01, "Price must be > 0"),
  currency: z.string().min(3).max(3),
  imageUrl: z.string().url("Must be a valid URL"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  active: z.boolean(),
});

export default function Editor() {
  const [school, setSchool] = useState<"alvarado" | "shelyn">(() => localStorage.getItem("adminSchool") === "shelyn" ? "shelyn" : "alvarado");
  const [pinAuthed, setPinAuthed] = useState(() => sessionStorage.getItem("adminAuthed") === "1");
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [pinShake, setPinShake] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [newPinDigits, setNewPinDigits] = useState(["", "", "", ""]);
  const [pinChangeMsg, setPinChangeMsg] = useState("");
  const [pinChanging, setPinChanging] = useState(false);
  const newPinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const [devTesting, setDevTesting] = useState(false);
  const [devTestExpiresAt, setDevTestExpiresAt] = useState<Date | null>(null);
  const [devTestCountdown, setDevTestCountdown] = useState("");
  const [devTestLoading, setDevTestLoading] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch("/api/maintenance/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { enabled?: boolean };
      setMaintenanceEnabled(data.enabled === true);
    } catch { /* ignore */ }
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !maintenanceEnabled }),
      });
      const data = await res.json() as { enabled?: boolean; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Unable to change maintenance mode"); return; }
      setMaintenanceEnabled(data.enabled === true);
      toast.success(data.enabled ? "Maintenance mode is on" : "Maintenance mode is off");
    } catch { toast.error("Connection error"); }
    finally { setMaintenanceLoading(false); }
  };

  useEffect(() => { if (pinAuthed) void fetchMaintenanceStatus(); }, [pinAuthed]);

  const fetchDevTestStatus = async () => {
    try {
      const res = await fetch("/api/dev-testing/status");
      const data = await res.json() as { active: boolean; expiresAt: string | null };
      setDevTesting(data.active);
      setDevTestExpiresAt(data.active && data.expiresAt ? new Date(data.expiresAt) : null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void fetchDevTestStatus();
    const poll = setInterval(() => void fetchDevTestStatus(), 30_000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!devTestExpiresAt) { setDevTestCountdown(""); return; }
    const tick = () => {
      const remaining = devTestExpiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        setDevTesting(false);
        setDevTestExpiresAt(null);
        setDevTestCountdown("");
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        return;
      }
      const m = Math.floor(remaining / 60_000);
      const s = Math.floor((remaining % 60_000) / 1000);
      setDevTestCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [devTestExpiresAt]);

  const startDevTesting = async () => {
    if (!confirm("Start a 10-minute dev testing session?\n\nAll changes to orders and product stock will be automatically reverted when the session ends or you click Stop.")) return;
    setDevTestLoading(true);
    try {
      const res = await fetch("/api/dev-testing/start", { method: "POST" });
      const data = await res.json() as { active?: boolean; expiresAt?: string; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to start"); return; }
      setDevTesting(true);
      setDevTestExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      toast.success("Dev testing mode active — changes will be reverted on stop");
    } catch { toast.error("Connection error"); }
    finally { setDevTestLoading(false); }
  };

  const stopDevTesting = async () => {
    if (!confirm("Stop dev testing and revert all changes made during this session?")) return;
    setDevTestLoading(true);
    try {
      const res = await fetch("/api/dev-testing/stop", { method: "POST" });
      const data = await res.json() as { restored?: boolean; orderCount?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to stop"); return; }
      setDevTesting(false);
      setDevTestExpiresAt(null);
      toast.success(`Testing session ended — ${data.orderCount ?? 0} orders restored`);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
    } catch { toast.error("Connection error"); }
    finally { setDevTestLoading(false); }
  };

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
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        sessionStorage.setItem("adminAuthed", "1");
        setPinAuthed(true);
      } else {
        setPinShake(true);
        setPinError(data.error ?? "Incorrect PIN. Try again.");
        setPinDigits(["", "", "", ""]);
        setTimeout(() => { setPinShake(false); pinRefs[0].current?.focus(); }, 600);
      }
    } catch {
      setPinError("Connection error. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  const handlePinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pinDigits];
    next[idx] = digit;
    setPinDigits(next);
    if (digit && idx < 3) {
      pinRefs[idx + 1].current?.focus();
    } else if (digit && idx === 3) {
      submitPin(next);
    }
  };

  const handleNewPinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...newPinDigits];
    next[idx] = digit;
    setNewPinDigits(next);
    if (digit && idx < 3) newPinRefs[idx + 1].current?.focus();
  };

  const handleNewPinKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !newPinDigits[idx] && idx > 0) {
      newPinRefs[idx - 1].current?.focus();
    }
  };

  const submitNewPin = async () => {
    const pin = newPinDigits.join("");
    if (pin.length !== 4) { setPinChangeMsg("Enter all 4 digits."); return; }
    setPinChanging(true);
    setPinChangeMsg("");
    try {
      const res = await fetch("/api/admin/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: pin }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        setNewPinDigits(["", "", "", ""]);
        setPinChangeMsg("PIN updated successfully.");
        newPinRefs[0].current?.focus();
      } else {
        setPinChangeMsg(data.error ?? "Failed to update PIN.");
      }
    } catch {
      setPinChangeMsg("Connection error.");
    } finally {
      setPinChanging(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"content" | "products" | "orders" | "email">("content");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [testEmailTo, setTestEmailTo] = useState<string>("");

  const { data: content, isLoading: contentLoading } = useGetContent({ school });
  const { data: products } = useListProducts({ school });
  const { data: orders } = useListOrders({ school });

  const updateContent = useUpdateContent();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const updateOrderStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();
  const sendTestEmail = useSendTestEmail();

  const handleStatusChange = (orderId: number, status: UpdateOrderStatusStatus) => {
    updateOrderStatus.mutate(
      { id: orderId, data: { status } },
      {
        onSuccess: () => {
          toast.success(`Order #${orderId} marked as ${status}`);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  const exportOrdersToExcel = () => {
    if (!orders?.length) { toast.error("No orders to export"); return; }

    const fmt = (cents: number) => (cents / 100).toFixed(2);
    const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    const ordersSheet = orders.map((o) => ({
      "Order #": o.id,
      "Date": fmtDate(o.createdAt),
      "Status": o.status,
      "Customer Name": o.customerName,
      "Email": o.customerEmail,
      "Student ID": o.customerPhone ?? "",
      "Classroom": o.classroom ?? "",
      "Shipping Address": o.shippingAddress,
      "City": o.city,
      "Postal Code": o.postalCode,
      "Country": o.country,
      "Use Default Address": o.useDefaultAddress ? "Yes" : "No",
      "Notes": o.notes ?? "",
      "Payment Method": o.paymentMethod,
      "Order Type": o.orderType,
      "Payment Status": o.paymentStatus,
      "Subtotal ($)": parseFloat(fmt(o.subtotalCents)),
      "Shipping ($)": parseFloat(fmt(o.shippingCents)),
      "Total ($)": parseFloat(fmt(o.totalCents)),
      "Currency": o.currency,
      "UTM Source": o.utmSource ?? "",
      "UTM Medium": o.utmMedium ?? "",
      "UTM Campaign": o.utmCampaign ?? "",
      "Landing Page": o.landingPage ?? "",
    }));

    const itemsSheet = orders.flatMap((o) =>
      o.items.map((it) => ({
        "Order #": o.id,
        "Customer": o.customerName,
        "Product Name": it.productName,
        "Quantity": it.quantity,
        "Unit Price ($)": parseFloat(fmt(it.unitPriceCents)),
        "Line Total ($)": parseFloat(fmt(it.unitPriceCents * it.quantity)),
      }))
    );

    const wb = XLSX.utils.book_new();

    const wsOrders = XLSX.utils.json_to_sheet(ordersSheet);
    wsOrders["!cols"] = [
      {wch:10},{wch:22},{wch:12},{wch:22},{wch:28},{wch:14},{wch:12},
      {wch:28},{wch:16},{wch:12},{wch:8},{wch:20},{wch:20},{wch:18},
      {wch:12},{wch:12},{wch:12},{wch:8},{wch:14},{wch:14},{wch:16},{wch:40},
    ];

    const wsItems = XLSX.utils.json_to_sheet(itemsSheet);
    wsItems["!cols"] = [{wch:10},{wch:22},{wch:40},{wch:10},{wch:14},{wch:14}];

    XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");
    XLSX.utils.book_append_sheet(wb, wsItems, "Order Items");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `afeon-orders-${date}.xlsx`);
    toast.success(`Exported ${orders.length} orders`);
  };

  const handleDeleteOrder = (orderId: number) => {
    if (!confirm(`Permanently delete order #${orderId}? This cannot be undone.`)) return;
    deleteOrder.mutate(
      { id: orderId },
      {
        onSuccess: () => {
          toast.success(`Order #${orderId} deleted`);
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        },
        onError: () => toast.error("Failed to delete order"),
      }
    );
  };

  const queryClient = useQueryClient();

  const contentForm = useForm<z.infer<typeof contentSchema>>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      brandName: "", navHomeLabel: "", heroTitle: "", heroSubtitle: "",
      ctaLabel: "", ctaUrl: "", coverImageUrl: "", aboutHeading: "",
      aboutBody: "", authorsLine: "", illustratorLine: "", footerNote: "", accentColor: "#000",
      defaultShippingLabel: "",
      defaultShippingAddress: "",
      defaultShippingCity: "",
      defaultShippingPostalCode: "",
      defaultShippingCountry: "",
      ordersEnabled: true,
      emailEnabled: false,
      emailFromName: "AFEON Books",
      emailFromAddress: "onboarding@resend.dev",
      emailReplyTo: "",
      emailSubject: "Your order #{{orderId}} is confirmed!",
      emailHeading: "Thank you for your order!",
      emailIntro: "",
      emailButtonLabel: "View your order",
      emailFooter: "",
      emailAccentColor: "#E2553B",
      checkoutFields: [],
    },
  });

  const initialized = useRef(false);
  useEffect(() => { initialized.current = false; localStorage.setItem("adminSchool", school); }, [school]);
  useEffect(() => {
    if (content && !initialized.current) {
      contentForm.reset(content);
      initialized.current = true;
    }
  }, [content, contentForm]);

  const onContentSubmit = (values: z.infer<typeof contentSchema>) => {
    updateContent.mutate({ data: values, params: { school } }, {
      onSuccess: (data) => {
        toast.success("Site content saved!");
        queryClient.setQueryData(getGetContentQueryKey({ school }), data);
      },
      onError: () => toast.error("Failed to save site content.")
    });
  };

  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", description: "", priceDollars: 10.00, currency: "USD",
      imageUrl: "", stock: 100, active: true
    }
  });

  const onProductSubmit = (values: z.infer<typeof productSchema>) => {
    const payload = {
      name: values.name,
      description: values.description,
      priceCents: Math.round(values.priceDollars * 100),
      currency: values.currency,
      imageUrl: values.imageUrl,
      stock: values.stock,
      active: values.active
    };

    if (editingProductId) {
      updateProduct.mutate({ id: editingProductId, data: payload }, {
        onSuccess: () => {
          toast.success("Product updated!");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ school }) });
          setEditingProductId(null);
          productForm.reset();
        },
        onError: () => toast.error("Failed to update product.")
      });
    } else {
      createProduct.mutate({ data: payload, params: { school } }, {
        onSuccess: () => {
          toast.success("Product added!");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ school }) });
          productForm.reset();
        },
        onError: () => toast.error("Failed to add product.")
      });
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProductId(product.id);
    productForm.reset({
      name: product.name,
      description: product.description,
      priceDollars: product.priceCents / 100,
      currency: product.currency,
      imageUrl: product.imageUrl,
      stock: product.stock,
      active: product.active
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast.success("Product deleted.");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ school }) });
        },
        onError: () => toast.error("Failed to delete product.")
      });
    }
  };

  const coverImageUrl = contentForm.watch("coverImageUrl");

  const emailWatch = contentForm.watch([
    "brandName",
    "footerNote",
    "emailFromName",
    "emailSubject",
    "emailHeading",
    "emailIntro",
    "emailButtonLabel",
    "emailFooter",
    "emailAccentColor",
    "defaultShippingLabel",
    "defaultShippingAddress",
    "defaultShippingCity",
    "defaultShippingPostalCode",
    "defaultShippingCountry",
  ]);

  const emailPreviewHtml = useMemo(() => {
    const [
      brandName, footerNote, emailFromName, emailSubject, emailHeading,
      emailIntro, emailButtonLabel, emailFooter, emailAccentColor,
      defaultShippingLabel, defaultShippingAddress, defaultShippingCity,
      defaultShippingPostalCode, defaultShippingCountry,
    ] = emailWatch;
    return renderEmailPreview({
      brandName: brandName || "",
      footerNote: footerNote || "",
      emailFromName: emailFromName || "",
      emailSubject: emailSubject || "",
      emailHeading: emailHeading || "",
      emailIntro: emailIntro || "",
      emailButtonLabel: emailButtonLabel || "",
      emailFooter: emailFooter || "",
      emailAccentColor: emailAccentColor || "#E2553B",
      defaultShippingLabel: defaultShippingLabel || "",
      defaultShippingAddress: defaultShippingAddress || "",
      defaultShippingCity: defaultShippingCity || "",
      defaultShippingPostalCode: defaultShippingPostalCode || "",
      defaultShippingCountry: defaultShippingCountry || "",
    });
  }, [emailWatch]);

  const handleSendTestEmail = () => {
    const to = testEmailTo.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    contentForm.handleSubmit((values) => {
      updateContent.mutate({ data: values }, {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetContentQueryKey(), data);
          sendTestEmail.mutate({ data: { to } }, {
            onSuccess: (res) => {
              if (res.ok) {
                toast.success(res.message || `Test email sent to ${to}`);
              } else {
                toast.error(res.message || "Failed to send test email.");
              }
            },
            onError: () => toast.error("Failed to send test email."),
          });
        },
        onError: () => toast.error("Couldn't save template before sending test."),
      });
    })();
  };

  if (!pinAuthed) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center px-6 allow-select">
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <img src={xlogo} alt="" className="w-12 h-12 object-contain mx-auto mb-6" draggable={false} />
            <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
            <p className="text-black/50 text-sm mt-2">Enter your 4-digit PIN to continue</p>
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
          {pinError && <p className="text-center text-red-600 text-sm font-medium mb-4">{pinError}</p>}
          <button
            onClick={() => submitPin(pinDigits)}
            disabled={pinLoading || pinDigits.join("").length !== 4}
            className="w-full bg-black text-white py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-40 transition-opacity"
          >
            {pinLoading ? "Verifying..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  if (contentLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-20 font-sans allow-select">
      <header className="bg-white border-b border-black/10 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" aria-label="Home" className="w-9 h-9 flex items-center justify-center hover:opacity-80 transition-opacity">
              <img src={xlogo} alt="" className="w-full h-full object-contain" draggable={false} />
            </a>
            <h1 className="font-bold text-xl tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4 items-center">
            <select
              value={school}
              onChange={(event) => {
                const next = event.target.value as "alvarado" | "shelyn";
                setSchool(next);
                setEditingProductId(null);
                productForm.reset();
              }}
              className="h-10 border border-black/20 bg-[#FAF7F2] px-3 text-sm font-bold"
              aria-label="School"
            >
              <option value="alvarado">{SCHOOL_OPTIONS.alvarado.label}</option>
              <option value="shelyn">{SCHOOL_OPTIONS.shelyn.label}</option>
            </select>
            <a
              href="/"
              className="inline-flex items-center justify-center min-h-9 px-4 py-2 rounded-md text-sm font-medium border border-black/20 hover:bg-black/5 transition-colors"
            >
              View Site
            </a>
            <button
              type="button"
              onClick={() => void toggleMaintenance()}
              disabled={maintenanceLoading}
              className="inline-flex items-center justify-center min-h-9 px-4 py-2 rounded-md text-sm font-medium border border-amber-400 text-amber-800 hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {maintenanceLoading ? "Updating..." : maintenanceEnabled ? "Turn Off Maintenance" : "Turn On Maintenance"}
            </button>
            {devTesting ? (
              <Button
                type="button"
                onClick={stopDevTesting}
                disabled={devTestLoading}
                className="rounded-none bg-amber-500 hover:bg-amber-600 text-white uppercase tracking-widest text-xs font-bold gap-2"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {devTestCountdown ? `Stop Testing (${devTestCountdown})` : "Stop Testing"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={startDevTesting}
                disabled={devTestLoading}
                className="rounded-none bg-amber-500 hover:bg-amber-600 text-white uppercase tracking-widest text-xs font-bold gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                Dev Testing
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                const current = contentForm.getValues();
                const newValue = !current.ordersEnabled;
                contentForm.setValue("ordersEnabled", newValue);
                updateContent.mutate(
                  { data: { ...current, ordersEnabled: newValue }, params: { school } },
                  {
                    onSuccess: () => toast.success(newValue ? "Now accepting orders" : "Orders paused — store is closed"),
                    onError: () => {
                      contentForm.setValue("ordersEnabled", !newValue);
                      toast.error("Failed to update");
                    },
                  }
                );
              }}
              disabled={updateContent.isPending}
              className={`rounded-none uppercase tracking-widest text-xs font-bold transition-colors ${
                contentForm.watch("ordersEnabled")
                  ? "bg-emerald-600 hover:bg-red-600 text-white"
                  : "bg-red-600 hover:bg-emerald-600 text-white"
              }`}
            >
              {contentForm.watch("ordersEnabled") ? "Accepting Orders" : "Orders Paused"}
            </Button>
            {(activeTab === "content" || activeTab === "email") && (
              <Button
                onClick={contentForm.handleSubmit(onContentSubmit)}
                disabled={updateContent.isPending}
                className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold"
              >
                {updateContent.isPending ? "Saving..." : activeTab === "email" ? "Save Email Template" : "Save Content"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8 mb-12 border-b border-black/10">
          {(["content", "products", "email", "orders"] as const).map((tab) => (
            <button
              key={tab}
              className={`pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors ${activeTab === tab ? "border-black text-black" : "border-transparent text-black/40 hover:text-black/80"}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "content" ? "Site Content" : tab === "orders" ? "Recent Orders" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "content" && (
          <Form {...contentForm}>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-12">
                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">General Settings</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="brandName" render={({ field }) => (
                      <FormItem><FormLabel>Brand Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="accentColor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accent Color (Hex)</FormLabel>
                        <div className="flex gap-2">
                          <FormControl><Input type="color" className="w-12 h-10 p-1 rounded-none cursor-pointer" {...field} /></FormControl>
                          <FormControl><Input {...field} className="rounded-none font-mono" /></FormControl>
                        </div>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Hero Section</h2>
                  <FormField control={contentForm.control} name="heroTitle" render={({ field }) => (
                    <FormItem><FormLabel>Hero Title</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="heroSubtitle" render={({ field }) => (
                    <FormItem><FormLabel>Hero Subtitle</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[100px]" /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="ctaLabel" render={({ field }) => (
                      <FormItem><FormLabel>CTA Label</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="ctaUrl" render={({ field }) => (
                      <FormItem><FormLabel>CTA URL</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                  </div>
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Default Shipping Address</h2>
                  <p className="text-sm text-black/50 -mt-2">Used when customers choose "Ship to default address" at checkout. They will only enter their classroom number.</p>
                  <FormField control={contentForm.control} name="defaultShippingLabel" render={({ field }) => (
                    <FormItem><FormLabel>Display Label</FormLabel><FormControl><Input {...field} placeholder="e.g. School Delivery" className="rounded-none" /></FormControl></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="defaultShippingAddress" render={({ field }) => (
                    <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} placeholder="e.g. 123 Lincoln Avenue" className="rounded-none" /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="defaultShippingCity" render={({ field }) => (
                      <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="defaultShippingPostalCode" render={({ field }) => (
                      <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                  </div>
                  <FormField control={contentForm.control} name="defaultShippingCountry" render={({ field }) => (
                    <FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">About Section</h2>
                  <FormField control={contentForm.control} name="aboutHeading" render={({ field }) => (
                    <FormItem><FormLabel>Heading</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="aboutBody" render={({ field }) => (
                    <FormItem><FormLabel>Body Text</FormLabel><FormControl><Textarea className="min-h-[150px] rounded-none" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="authorsLine" render={({ field }) => (
                      <FormItem><FormLabel>Authors</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="illustratorLine" render={({ field }) => (
                      <FormItem><FormLabel>Illustrator</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                    )} />
                  </div>
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Checkout Fill-in Boxes</h2>
                    <p className="text-sm text-black/50 mt-1">These fields appear only for {SCHOOL_OPTIONS[school].label} shoppers.</p>
                  </div>
                  {(contentForm.watch("checkoutFields") ?? []).map((field, index) => (
                    <div key={field.id} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium leading-none">Box label</label>
                        <Input
                          value={field.label}
                          onChange={(event) => {
                            const next = [...(contentForm.getValues("checkoutFields") ?? [])];
                            next[index] = { ...next[index], label: event.target.value };
                            contentForm.setValue("checkoutFields", next);
                          }}
                          className="rounded-none"
                        />
                      </div>
                      <label className="flex items-center gap-2 h-10 text-sm font-medium">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(checked) => {
                            const next = [...(contentForm.getValues("checkoutFields") ?? [])];
                            next[index] = { ...next[index], required: checked === true };
                            contentForm.setValue("checkoutFields", next);
                          }}
                        />
                        Required
                      </label>
                      <Button type="button" variant="outline" className="rounded-none" onClick={() => {
                        const next = [...(contentForm.getValues("checkoutFields") ?? [])];
                        next.splice(index, 1);
                        contentForm.setValue("checkoutFields", next);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="rounded-none" onClick={() => {
                    const next = [...(contentForm.getValues("checkoutFields") ?? []), { id: `field-${Date.now()}`, label: "New field", required: false }];
                    contentForm.setValue("checkoutFields", next);
                  }}>
                    Add fill-in box
                  </Button>
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Navigation &amp; Footer</h2>
                  <FormField control={contentForm.control} name="navHomeLabel" render={({ field }) => (
                    <FormItem><FormLabel>Nav Home Label</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="footerNote" render={({ field }) => (
                    <FormItem><FormLabel>Footer Note</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white p-6 border border-black/5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest border-b border-black/10 pb-3">Cover Image</h3>
                  <FormField control={contentForm.control} name="coverImageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl><Input {...field} className="rounded-none text-xs" placeholder="https://..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {coverImageUrl && (
                    <img
                      src={coverImageUrl}
                      alt="Cover preview"
                      className="w-full aspect-[3/4] object-cover border border-black/10"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                <div className="bg-white p-6 border border-black/5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest border-b border-black/10 pb-3">Change PIN</h3>
                  <p className="text-xs text-black/50">Enter a new 4-digit admin PIN.</p>
                  <div className="flex gap-2 justify-start">
                    {newPinDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={newPinRefs[i]}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleNewPinInput(i, e.target.value)}
                        onKeyDown={(e) => handleNewPinKey(i, e)}
                        className="w-10 h-12 text-center text-xl font-bold border-2 border-black/20 bg-white focus:border-black focus:outline-none rounded-none transition-colors"
                      />
                    ))}
                  </div>
                  {pinChangeMsg && (
                    <p className={`text-xs font-medium ${pinChangeMsg.includes("success") ? "text-emerald-600" : "text-red-600"}`}>{pinChangeMsg}</p>
                  )}
                  <button
                    type="button"
                    onClick={submitNewPin}
                    disabled={pinChanging || newPinDigits.join("").length !== 4}
                    className="w-full bg-black text-white py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-40 transition-opacity"
                  >
                    {pinChanging ? "Updating..." : "Update PIN"}
                  </button>
                </div>
              </div>
            </form>
          </Form>
        )}

        {activeTab === "products" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <h2 className="text-xl font-bold mb-6">{editingProductId ? "Edit Product" : "Add Product"}</h2>
              <Form {...productForm}>
                <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={productForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={productForm.control} name="currency" render={({ field }) => (
                      <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} className="rounded-none font-mono uppercase" maxLength={3} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={productForm.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[100px]" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={productForm.control} name="priceDollars" render={({ field }) => (
                      <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={productForm.control} name="stock" render={({ field }) => (
                      <FormItem><FormLabel>Stock</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={productForm.control} name="imageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} className="rounded-none" placeholder="https://..." /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={productForm.control} name="active" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="mt-0 cursor-pointer">Active (visible in shop)</FormLabel>
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold">
                      {createProduct.isPending || updateProduct.isPending ? "Saving..." : editingProductId ? "Update Product" : "Add Product"}
                    </Button>
                    {editingProductId && (
                      <Button type="button" variant="outline" className="rounded-none border-black/20" onClick={() => { setEditingProductId(null); productForm.reset(); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-6">All Products ({products?.length ?? 0})</h2>
              <div className="space-y-3">
                {products?.map((p) => (
                  <div key={p.id} className="bg-white border border-black/5 shadow-sm p-4 flex gap-4 items-start">
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-20 object-cover flex-shrink-0 border border-black/10" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-black/50 mt-1">{formatPrice(p.priceCents, p.currency)} · {p.stock} in stock</p>
                      <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-sm ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleEditProduct(p)} className="p-1.5 hover:bg-black/5 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {!products?.length && <p className="text-sm text-black/40 py-8 text-center">No products yet.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <Form {...contentForm}>
              <form className="space-y-8">
                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-black/10 pb-4">
                    <h2 className="text-xl font-bold">Email Settings</h2>
                    <FormField control={contentForm.control} name="emailEnabled" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 m-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="mt-0 cursor-pointer text-xs uppercase tracking-widest font-bold">Enable emails</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="emailFromName" render={({ field }) => (
                      <FormItem><FormLabel>From Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="emailFromAddress" render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Address</FormLabel>
                        <FormControl><Input type="email" {...field} className="rounded-none" placeholder="orders@your-verified-domain.com" /></FormControl>
                        <p className="text-xs text-black/50">Use any sender address at a domain verified in MailerSend.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={contentForm.control} name="emailReplyTo" render={({ field }) => (
                    <FormItem><FormLabel>Reply-To (optional)</FormLabel><FormControl><Input type="email" {...field} className="rounded-none" placeholder="leave blank to use From Address" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailSubject" render={({ field }) => (
                    <FormItem><FormLabel>Subject Line</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Email Content</h2>
                  <FormField control={contentForm.control} name="emailHeading" render={({ field }) => (
                    <FormItem><FormLabel>Heading</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailIntro" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intro Message</FormLabel>
                      <p className="text-xs text-black/50">Variables: {`{{customerName}}, {{orderId}}, {{total}}, {{paymentMethod}}`}</p>
                      <FormControl><Textarea {...field} className="rounded-none min-h-[120px]" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailButtonLabel" render={({ field }) => (
                    <FormItem><FormLabel>Button Label</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailFooter" render={({ field }) => (
                    <FormItem><FormLabel>Footer Text</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[80px]" /></FormControl></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailAccentColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accent Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input type="color" className="w-12 h-10 p-1 rounded-none cursor-pointer" {...field} /></FormControl>
                        <FormControl><Input {...field} className="rounded-none font-mono" /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                </div>

                <div className="bg-white p-6 border border-black/5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest">Send Test Email</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder="your@email.com"
                      className="rounded-none flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={sendTestEmail.isPending || updateContent.isPending}
                      className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold shrink-0"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {sendTestEmail.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>

            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-black/50">Live Preview</h3>
              <div className="border border-black/10 overflow-hidden" style={{ height: "700px" }}>
                <iframe
                  srcDoc={emailPreviewHtml}
                  className="w-full h-full"
                  sandbox="allow-same-origin"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-6">
            {devTesting && (
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 border border-amber-300 text-amber-900">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold uppercase tracking-widest animate-pulse">
                    ● Testing Active
                  </span>
                  <span className="text-sm">
                    All changes to orders and stock will be reverted when you stop.
                    {devTestCountdown && (
                      <span className="ml-2 font-mono font-bold">{devTestCountdown} remaining</span>
                    )}
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={stopDevTesting}
                  disabled={devTestLoading}
                  className="rounded-none bg-amber-600 hover:bg-amber-700 text-white uppercase tracking-widest text-xs font-bold h-8 px-4 shrink-0"
                >
                  Stop & Revert
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Orders ({orders?.length ?? 0})</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={exportOrdersToExcel}
                  disabled={!orders?.length}
                  className="rounded-none bg-white border border-black/20 text-black hover:bg-black/5 uppercase tracking-widest text-xs font-bold gap-2 h-9 px-4"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel
                </Button>
                <a
                  href="/admin/pos"
                  className="inline-flex items-center gap-2 px-4 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  POS Checkout
                </a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-black/5 shadow-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.02] text-left">
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">#</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Customer</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Items</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Total</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Source</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.map((order) => (
                    <tr key={order.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-black/50">#{order.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-black/50">{order.customerEmail}</p>
                        {order.customerPhone && <p className="text-xs text-black/40">{order.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {order.items.map((item) => (
                            <p key={item.id} className="text-xs text-black/70">{item.quantity}× {item.productName}</p>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold">{formatPrice(order.totalCents, order.currency)}</td>
                      <td className="px-4 py-3 text-xs text-black/50">
                        {order.utmSource
                          ? <span className="font-medium text-black/70">{[order.utmSource, order.utmMedium].filter(Boolean).join(" · ")}{order.utmCampaign ? <><br/><span className="text-black/40">{order.utmCampaign}</span></> : null}</span>
                          : "Direct"
                        }
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as UpdateOrderStatusStatus)}
                          className={`text-xs font-semibold px-2 py-1 rounded-sm border cursor-pointer focus:outline-none ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-black/50">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded transition-colors"
                          title="Delete order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!orders?.length && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-black/40">No orders yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
