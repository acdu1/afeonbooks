import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetContent, useCreateOrder, getGetOrdersSummaryQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useUtm, utmPayload } from "@/lib/utm";
import { toast } from "sonner";
import { useSchool } from "@/lib/school";

const checkoutSchema = z
  .object({
    customerName: z.string().min(1, "Name is required"),
    customerEmail: z.string().email("Invalid email address"),
    customerPhone: z.string().min(3, "Phone number is required"),
    useDefaultAddress: z.boolean(),
    classroom: z.string().optional(),
    shippingAddress: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    notes: z.string().optional(),
    customFields: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((values, ctx) => {
    if (values.useDefaultAddress) {
      if (!values.classroom || values.classroom.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["classroom"],
          message: "Classroom Number is required",
        });
      }
    } else {
      if (!values.shippingAddress || values.shippingAddress.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingAddress"], message: "Address is required" });
      }
      if (!values.city || values.city.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "City is required" });
      }
      if (!values.postalCode || values.postalCode.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["postalCode"], message: "Postal code is required" });
      }
      if (!values.country || values.country.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["country"], message: "Country is required" });
      }
    }
  });

type CheckoutValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { school } = useSchool();
  const { data: content } = useGetContent({ school: school ?? "alvarado" });
  const { enrichedItems, itemCount, clear } = useCart();
  const { utm, clear: clearUtm } = useUtm();
  const createOrder = useCreateOrder();
  const queryClient = useQueryClient();

  const hasDefaultAddress = Boolean(
    content?.defaultShippingAddress &&
      content?.defaultShippingCity &&
      content?.defaultShippingPostalCode &&
      content?.defaultShippingCountry,
  );

  const subtotalCents = enrichedItems.reduce((sum, item) => {
    const price = item.product?.priceCents || 0;
    return sum + price * item.quantity;
  }, 0);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      useDefaultAddress: hasDefaultAddress,
      classroom: "",
      shippingAddress: "",
      city: "",
      postalCode: "",
      country: "",
      notes: "",
      customFields: {},
    },
  });

  const useDefaultAddress = form.watch("useDefaultAddress");

  const onSubmit = (values: CheckoutValues) => {
    if (itemCount === 0) {
      toast.error("Your cart is empty");
      return;
    }
    const missingField = (content?.checkoutFields ?? []).find((field) => field.required && !(values.customFields?.[field.id] ?? "").trim());
    if (missingField) {
      form.setError(`customFields.${missingField.id}`, { message: `${missingField.label} is required` });
      toast.error(`Please complete ${missingField.label}`);
      return;
    }

    const items = enrichedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    const utmFields = utmPayload(utm);
    const payload = values.useDefaultAddress
      ? {
           school: school ?? "alvarado",
           customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          useDefaultAddress: true,
          classroom: values.classroom?.trim() ?? "",
          notes: values.notes,
           customFields: values.customFields,
          items,
          ...utmFields,
        }
      : {
           school: school ?? "alvarado",
           customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          useDefaultAddress: false,
          shippingAddress: values.shippingAddress?.trim() ?? "",
          city: values.city?.trim() ?? "",
          postalCode: values.postalCode?.trim() ?? "",
          country: values.country?.trim() ?? "",
          notes: values.notes,
           customFields: values.customFields,
          items,
          ...utmFields,
        };

    createOrder.mutate({ data: payload }, {
      onSuccess: (order) => {
        clear();
        clearUtm();
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        setLocation(`/order/${order.id}`);
      },
      onError: () => {
        toast.error("Failed to place order. Please try again.");
      }
    });
  };

  if (content?.ordersEnabled === false) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-[#FAF7F2]">
        <SiteHeader simple />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Orders are currently paused</h1>
          <p className="text-black/60 mb-8 max-w-sm">We're not accepting new orders right now. Please check back soon!</p>
          <Button asChild className="rounded-full bg-black text-white px-8">
            <Link href="/shop">Back to Shop</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-[#FAF7F2]">
        <SiteHeader simple />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
          <Button asChild className="rounded-full bg-black text-white px-8 mt-4">
            <Link href="/shop">Go to Shop</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const defaultLabel = content?.defaultShippingLabel?.trim() || "Ship to default address";

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]"
      style={{ "--theme-accent": content?.accentColor || "#000" } as React.CSSProperties}
    >
      <SiteHeader simple />

      <main className="flex-1 w-full px-6 py-12">
        <div className="max-w-[1200px] mx-auto flex flex-col-reverse lg:flex-row gap-12 lg:gap-20 items-start">
          
          {/* Checkout Form */}
          <div className="w-full lg:w-[60%]">
            <div className="mb-12">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Checkout</h1>
              <p className="text-black/50 font-medium">Please enter your shipping details.</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                {(content?.checkoutFields ?? []).length > 0 && (
                  <div className="bg-white p-8 md:p-10 border border-black/5 space-y-6">
                    <h2 className="text-xl font-bold border-b border-black/10 pb-4">Additional Information</h2>
                    {(content?.checkoutFields ?? []).map((field) => (
                      <FormItem key={field.id}>
                        <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">{field.label}{field.required ? " *" : " (Optional)"}</FormLabel>
                        <FormControl>
                          <Input {...form.register(`customFields.${field.id}`)} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                        </FormControl>
                        <FormMessage>{form.formState.errors.customFields?.[field.id]?.message}</FormMessage>
                      </FormItem>
                    ))}
                  </div>
                )}

                <div className="bg-white p-8 md:p-10 border border-black/5 space-y-8">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Contact Information</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="customerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="customerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="customerPhone" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Student ID (s100)</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="bg-white p-8 md:p-10 border border-black/5 space-y-8">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Shipping Address</h2>

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => hasDefaultAddress && form.setValue("useDefaultAddress", true, { shouldValidate: true })}
                      disabled={!hasDefaultAddress}
                      className={`w-full text-left p-6 flex items-start gap-4 transition-colors ${
                        useDefaultAddress
                          ? "border-2 border-black bg-[#FAF7F2]/50"
                          : "border border-black/15 hover:border-black/40 bg-white"
                      } ${!hasDefaultAddress ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded-full border-4 flex items-center justify-center shrink-0 ${useDefaultAddress ? "border-black" : "border-black/30"}`}>
                        {useDefaultAddress && <div className="w-2 h-2 bg-black rounded-full"></div>}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{defaultLabel}</h3>
                        {hasDefaultAddress ? (
                          <p className="text-black/60 font-medium leading-relaxed text-sm">
                            {content?.defaultShippingAddress}, {content?.defaultShippingCity}, {content?.defaultShippingPostalCode}, {content?.defaultShippingCountry}
                          </p>
                        ) : (
                          <p className="text-black/50 font-medium leading-relaxed text-sm italic">
                            No default address has been configured yet.
                          </p>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => form.setValue("useDefaultAddress", false, { shouldValidate: true })}
                      className={`w-full text-left p-6 flex items-start gap-4 transition-colors ${
                        !useDefaultAddress
                          ? "border-2 border-black bg-[#FAF7F2]/50"
                          : "border border-black/15 hover:border-black/40 bg-white"
                      }`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded-full border-4 flex items-center justify-center shrink-0 ${!useDefaultAddress ? "border-black" : "border-black/30"}`}>
                        {!useDefaultAddress && <div className="w-2 h-2 bg-black rounded-full"></div>}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">Custom address</h3>
                        <p className="text-black/60 font-medium leading-relaxed text-sm">
                          Ship to a different address you enter yourself.
                        </p>
                      </div>
                    </button>
                  </div>

                  {useDefaultAddress ? (
                    <div className="space-y-6 pt-2">
                      <FormField control={form.control} name="classroom" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Classroom Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Room 204" className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  ) : (
                    <div className="space-y-6 pt-2">
                      <FormField control={form.control} name="shippingAddress" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">City</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="postalCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Postal Code</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="country" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Country</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-12 bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 md:p-10 border border-black/5 space-y-8">
                  <h2 className="text-xl font-bold border-b border-black/10 pb-4">Payment Method</h2>
                  <div className="border-2 border-black p-6 flex items-start gap-4 bg-[#FAF7F2]/50">
                    <div className="mt-1 w-5 h-5 rounded-full border-4 border-black flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Cash on Delivery</h3>
                      <p className="text-black/60 font-medium leading-relaxed">You will pay in cash when your order is delivered. No credit card required now.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 md:p-10 border border-black/5 space-y-8">
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-black/50 font-bold">Order Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="min-h-[100px] bg-transparent border-black/20 rounded-none focus-visible:ring-0 focus-visible:border-black shadow-none resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button 
                  type="submit" 
                  disabled={createOrder.isPending}
                  className="w-full h-16 rounded-none bg-black hover:bg-[var(--theme-accent)] text-white text-[14px] uppercase tracking-widest font-bold transition-colors"
                >
                  {createOrder.isPending ? "Processing..." : "Place Order"}
                </Button>

              </form>
            </Form>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-[40%] bg-white p-8 md:p-10 border border-black/5 sticky top-12">
            <h2 className="text-xl font-bold mb-8 pb-4 border-b border-black/10">Order Summary</h2>
            
            <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2">
              {enrichedItems.map((item) => {
                const p = item.product;
                if (!p) return null;
                return (
                  <div key={item.productId} className="flex gap-4 items-center">
                    <div className="w-16 h-20 bg-[#FAF7F2] p-1 shrink-0 flex items-center justify-center relative">
                      <img src={p.imageUrl || "https://placehold.co/100x150?text=Img"} alt={p.name} className="w-full h-full object-contain mix-blend-multiply" />
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate mb-1">{p.name}</p>
                      <p className="text-black/50 text-xs font-medium">{formatPrice(p.priceCents, p.currency)}</p>
                    </div>
                    <div className="font-bold text-sm shrink-0">
                      {formatPrice(p.priceCents * item.quantity, p.currency)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 mb-8 pt-6 border-t border-black/10 font-medium text-sm">
              <div className="flex justify-between">
                <span className="text-black/60">Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">Shipping</span>
                <span>Free</span>
              </div>
            </div>

            <div className="pt-6 border-t border-black/10 flex justify-between items-end">
              <div>
                <span className="block text-xs uppercase tracking-widest text-black/50 font-bold mb-1">Total to pay</span>
                <span className="text-sm font-medium text-black/40">Cash on delivery</span>
              </div>
              <span className="text-3xl font-bold">{formatPrice(subtotalCents)}</span>
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
