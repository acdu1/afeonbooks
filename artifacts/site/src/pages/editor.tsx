import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
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
import { Edit2, Trash2, Send } from "lucide-react";
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

// --- Content Editor Schema ---
const contentSchema = z.object({
  loyaltyPagesPerDollar: z.coerce.number().int().min(0).max(1000000),
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
  blogTitle: z.string().min(1),
  blogSubtitle: z.string().min(1),
  blogDate: z.string().min(1),
  blogHeroImageUrl: z.string(),
  blogBody: z.string().min(1),
});

// --- Product Editor Schema ---
const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  priceDollars: z.coerce.number().min(0.01, "Price must be > 0"),
  currency: z.string().min(3).max(3),
  imageUrl: z.string().url("Must be a valid URL"),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  active: z.boolean(),
  showInShop: z.boolean(),
});

export default function Editor() {
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

  const { data: content, isLoading: contentLoading } = useGetContent();
  const { data: products } = useListProducts();
  const { data: orders } = useListOrders();

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

  // --- Content Form ---
  const contentForm = useForm<z.infer<typeof contentSchema>>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      loyaltyPagesPerDollar: 50,
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
      blogTitle: "Progress Update",
      blogSubtitle: "A look inside the latest adventure from the AFEON Books team.",
      blogDate: "September 15, 2026",
      blogHeroImageUrl: "",
      blogBody: "We are back at the writing table, building the next mystery one clue at a time.\n\nThe next book is taking shape with bigger questions, stranger discoveries, and a brand-new trail for our detectives to follow. We cannot wait to share more soon.",
    },
  });

  const initialized = useRef(false);
  useEffect(() => {
    if (content && !initialized.current) {
      contentForm.reset(content);
      initialized.current = true;
    }
  }, [content, contentForm]);

  const onContentSubmit = (values: z.infer<typeof contentSchema>) => {
    updateContent.mutate({ data: values }, {
      onSuccess: (data) => {
        toast.success("Site content saved!");
        queryClient.setQueryData(getGetContentQueryKey(), data);
      },
      onError: () => toast.error("Failed to save site content.")
    });
  };

  // --- Product Form ---
  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", description: "", priceDollars: 10.00, currency: "USD",
      imageUrl: "", stock: 100, active: true, showInShop: true
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
      active: values.active,
      showInShop: values.showInShop,
    };

    if (editingProductId) {
      updateProduct.mutate({ id: editingProductId, data: payload }, {
        onSuccess: () => {
          toast.success("Product updated!");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setEditingProductId(null);
          productForm.reset();
        },
        onError: () => toast.error("Failed to update product.")
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success("Product added!");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
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
      active: product.active,
      showInShop: product.showInShop,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast.success("Product deleted.");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
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
            <Link href="/" aria-label="Home" className="w-9 h-9 flex items-center justify-center hover:opacity-80 transition-opacity">
              <img src={xlogo} alt="" className="w-full h-full object-contain" draggable={false} />
            </Link>
            <h1 className="font-bold text-xl tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4 items-center">
            <Button variant="outline" asChild className="rounded-none border-black/20 hover:bg-black/5">
              <Link href="/">View Site</Link>
            </Button>
            <Button
              type="button"
              onClick={() => {
                const current = contentForm.getValues();
                const newValue = !current.ordersEnabled;
                contentForm.setValue("ordersEnabled", newValue);
                updateContent.mutate(
                  { data: { ...current, ordersEnabled: newValue } },
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
          <button 
            className={`pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors ${activeTab === "content" ? "border-black text-black" : "border-transparent text-black/40 hover:text-black/80"}`}
            onClick={() => setActiveTab("content")}
          >
            Site Content
          </button>
          <button 
            className={`pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors ${activeTab === "products" ? "border-black text-black" : "border-transparent text-black/40 hover:text-black/80"}`}
            onClick={() => setActiveTab("products")}
          >
            Products
          </button>
          <button
            className={`pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors ${activeTab === "email" ? "border-black text-black" : "border-transparent text-black/40 hover:text-black/80"}`}
            onClick={() => setActiveTab("email")}
          >
            Email
          </button>
          <button
            className={`pb-4 font-bold text-sm tracking-widest uppercase border-b-2 transition-colors ${activeTab === "orders" ? "border-black text-black" : "border-transparent text-black/40 hover:text-black/80"}`}
            onClick={() => setActiveTab("orders")}
          >
            Recent Orders
          </button>
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

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-4">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Loyalty Pages</h2>
                  <p className="text-sm text-black/50">Pages earned for each whole dollar spent on a delivered order. Set to 0 to pause earning.</p>
                  <FormField control={contentForm.control} name="loyaltyPagesPerDollar" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pages earned per dollar</FormLabel>
                      <FormControl><Input type="number" min="0" max="1000000" step="1" {...field} className="max-w-xs rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
              </div>

              <div className="space-y-8">
                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6 sticky top-24">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Cover Image</h2>
                  <FormField control={contentForm.control} name="coverImageUrl" render={({ field }) => (
                    <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input type="url" {...field} className="rounded-none" /></FormControl></FormItem>
                  )} />
                  {coverImageUrl && (
                    <div className="mt-6 aspect-[3/4] bg-[#FAF7F2] border border-black/5 p-4 flex items-center justify-center">
                      <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-4">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Admin PIN</h2>
                  <p className="text-sm text-black/50">Set a new 4-digit PIN for admin access.</p>
                  <div className="flex gap-3 justify-start">
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
                        className="w-10 h-12 text-center text-xl font-bold border-2 border-black/20 bg-[#FAF7F2] focus:border-black focus:outline-none rounded-none transition-colors"
                      />
                    ))}
                  </div>
                  {pinChangeMsg && (
                    <p className={`text-sm font-medium ${pinChangeMsg.includes("success") ? "text-emerald-600" : "text-red-600"}`}>
                      {pinChangeMsg}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={submitNewPin}
                    disabled={pinChanging || newPinDigits.join("").length !== 4}
                    className="w-full rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold disabled:opacity-40"
                  >
                    {pinChanging ? "Saving..." : "Update PIN"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}

        {activeTab === "products" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 border border-black/5 shadow-sm sticky top-24">
                <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-6">
                  <h2 className="text-xl font-bold">{editingProductId ? "Edit Product" : "Add Product"}</h2>
                  {editingProductId && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingProductId(null); productForm.reset(); }} className="text-xs uppercase tracking-widest font-bold text-black/50">Cancel Edit</Button>
                  )}
                </div>
                
                <Form {...productForm}>
                  <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-6">
                    <FormField control={productForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={productForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[120px]" /></FormControl><FormMessage/></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={productForm.control} name="priceDollars" render={({ field }) => (
                        <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                      )} />
                      <FormField control={productForm.control} name="stock" render={({ field }) => (
                        <FormItem><FormLabel>Stock Qty</FormLabel><FormControl><Input type="number" {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                      )} />
                    </div>
                    <FormField control={productForm.control} name="imageUrl" render={({ field }) => (
                      <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input type="url" {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={productForm.control} name="active" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-4">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none data-[state=checked]:bg-black data-[state=checked]:text-white" /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>Available for orders and redemption</FormLabel></div>
                      </FormItem>
                    )} />
                    <FormField control={productForm.control} name="showInShop" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none data-[state=checked]:bg-black data-[state=checked]:text-white" /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>Show in regular shop</FormLabel></div>
                      </FormItem>
                    )} />
                    
                    <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="w-full rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold mt-4">
                      {editingProductId ? "Update Product" : "Add Product"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white p-8 border border-black/5 shadow-sm">
                <h2 className="text-xl font-bold border-b border-black/10 pb-4 mb-6">Product Catalog</h2>
                
                <div className="space-y-4">
                  {products?.map((p) => (
                    <div key={p.id} className="flex items-center gap-6 p-4 border border-black/10 hover:border-black/30 transition-colors">
                      <div className="w-16 h-24 bg-[#FAF7F2] shrink-0 p-2 flex items-center justify-center">
                        <img src={p.imageUrl || "https://placehold.co/200?text=NoImg"} alt={p.name} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-lg truncate">{p.name}</h3>
                          {!p.active && <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Unavailable</span>}
                          {!p.showInShop && <span className="bg-gray-100 text-gray-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Hidden from shop</span>}
                        </div>
                        <p className="text-black/50 text-sm mb-2">{formatPrice(p.priceCents, p.currency)} • {p.stock} in stock</p>
                        <p className="text-black/40 text-xs truncate max-w-md">{p.description}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => handleEditProduct(p)} className="rounded-none border-black/20 w-24">
                          <Edit2 className="w-3 h-3 mr-2" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(p.id)} className="rounded-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 w-24">
                          <Trash2 className="w-3 h-3 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!products || products.length === 0) && (
                    <p className="text-center text-black/50 py-12">No products added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <Form {...contentForm}>
            <form className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
                    <div>
                      <h2 className="text-xl font-bold">Order Confirmation Email</h2>
                      <p className="text-sm text-black/50 mt-1">Sent to customers automatically when they place an order.</p>
                    </div>
                    <FormField control={contentForm.control} name="emailEnabled" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 shrink-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none data-[state=checked]:bg-black data-[state=checked]:text-white" /></FormControl>
                        <FormLabel className="text-xs uppercase tracking-widest font-bold">Enabled</FormLabel>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={contentForm.control} name="emailFromName" render={({ field }) => (
                      <FormItem><FormLabel>From Name</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                    )} />
                    <FormField control={contentForm.control} name="emailFromAddress" render={({ field }) => (
                      <FormItem><FormLabel>From Email</FormLabel><FormControl><Input {...field} placeholder="orders@your-verified-domain.com" className="rounded-none" /></FormControl><FormMessage/></FormItem>
                    )} />
                  </div>
                  <FormField control={contentForm.control} name="emailReplyTo" render={({ field }) => (
                    <FormItem><FormLabel>Reply-To Email <span className="text-black/40 font-normal">(optional)</span></FormLabel><FormControl><Input {...field} placeholder="hello@yourstore.com" className="rounded-none" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailAccentColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Button / Accent Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input type="color" className="w-12 h-10 p-1 rounded-none cursor-pointer" {...field} /></FormControl>
                        <FormControl><Input {...field} className="rounded-none font-mono" /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Email Content</h2>
                  <div className="bg-[#FAF7F2] border border-black/10 p-4 text-xs">
                    <div className="font-bold uppercase tracking-widest text-black/60 mb-2">Available Variables</div>
                    <div className="font-mono text-black/70 leading-relaxed">
                      <code>{"{{customerName}}"}</code> · <code>{"{{orderId}}"}</code> · <code>{"{{total}}"}</code> · <code>{"{{paymentMethod}}"}</code> · <code>{"{{shippingAddress}}"}</code> · <code>{"{{classroom}}"}</code> · <code>{"{{brandName}}"}</code> · <code>{"{{orderUrl}}"}</code>
                    </div>
                  </div>
                  <FormField control={contentForm.control} name="emailSubject" render={({ field }) => (
                    <FormItem><FormLabel>Subject Line</FormLabel><FormControl><Input {...field} className="rounded-none font-mono text-sm" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailHeading" render={({ field }) => (
                    <FormItem><FormLabel>Headline</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailIntro" render={({ field }) => (
                    <FormItem><FormLabel>Intro Paragraph</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[140px]" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailButtonLabel" render={({ field }) => (
                    <FormItem><FormLabel>Button Label</FormLabel><FormControl><Input {...field} className="rounded-none" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={contentForm.control} name="emailFooter" render={({ field }) => (
                    <FormItem><FormLabel>Footer Text</FormLabel><FormControl><Textarea {...field} className="rounded-none min-h-[80px]" /></FormControl><FormMessage/></FormItem>
                  )} />
                </div>

                <div className="bg-white p-8 border border-black/5 shadow-sm space-y-4">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Send Test Email</h2>
                  <p className="text-sm text-black/50">Saves your template, then sends a sample order confirmation through MailerSend. The From Email can be any address at a domain verified in MailerSend.</p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      className="rounded-none flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={sendTestEmail.isPending || updateContent.isPending}
                      className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold gap-2"
                    >
                      <Send className="w-3 h-3" />
                      {sendTestEmail.isPending || updateContent.isPending ? "Sending..." : "Send Test"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="sticky top-24 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-widest text-black/50 font-bold">Live Preview</div>
                    <div className="text-xs text-black/40">updates as you type</div>
                  </div>
                  <div className="bg-white border border-black/10 shadow-sm overflow-hidden">
                    <iframe
                      title="Email preview"
                      srcDoc={emailPreviewHtml}
                      className="w-full h-[800px] border-0 bg-white"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Form>
        )}

        {activeTab === "orders" && (
          <div className="bg-white p-8 border border-black/5 shadow-sm">
            <h2 className="text-xl font-bold border-b border-black/10 pb-4 mb-6">Recent Orders</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-widest text-black/40 font-bold">
                    <th className="pb-4 pr-4">Order ID</th>
                    <th className="pb-4 px-4">Date</th>
                    <th className="pb-4 px-4">Customer</th>
                    <th className="pb-4 px-4">Source</th>
                    <th className="pb-4 px-4">Total</th>
                    <th className="pb-4 px-4">Status</th>
                    <th className="pb-4 pl-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-sm font-medium">
                  {orders?.map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="py-4 pr-4 font-bold">#{o.id}</td>
                      <td className="py-4 px-4 text-black/60">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-4">
                        <p>{o.customerName}</p>
                        <p className="text-xs text-black/50">{o.city}, {o.country}</p>
                      </td>
                      <td className="py-4 px-4">
                        {o.utmSource ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] uppercase tracking-wider font-bold">
                              {o.utmSource}
                              {o.utmMedium ? ` · ${o.utmMedium}` : ""}
                            </span>
                            {o.utmCampaign && (
                              <span className="text-xs text-black/50 truncate max-w-[160px]" title={o.utmCampaign}>
                                {o.utmCampaign}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-black/30">Direct</span>
                        )}
                      </td>
                      <td className="py-4 px-4">{formatPrice(o.totalCents, o.currency)}</td>
                      <td className="py-4 px-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleStatusChange(o.id, e.target.value as UpdateOrderStatusStatus)}
                          disabled={updateOrderStatus.isPending}
                          aria-label={`Status for order ${o.id}`}
                          className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border cursor-pointer outline-none focus:ring-2 focus:ring-black/30 transition-colors ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-white text-black normal-case">
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 pl-4 text-right whitespace-nowrap">
                        <Button asChild variant="ghost" size="sm" className="rounded-none text-xs uppercase tracking-widest font-bold">
                          <Link href={`/order/${o.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrder(o.id)}
                          disabled={deleteOrder.isPending}
                          className="rounded-none text-xs uppercase tracking-widest font-bold text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!orders || orders.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-black/50">No orders yet.</td>
                    </tr>
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
