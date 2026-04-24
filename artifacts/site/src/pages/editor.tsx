import { useEffect, useRef, useState } from "react";
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
import { Plus, Edit2, Trash2 } from "lucide-react";
import { 
  useGetContent, 
  useUpdateContent, 
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useListOrders,
  getGetContentQueryKey,
  getListProductsQueryKey
} from "@workspace/api-client-react";

// --- Content Editor Schema ---
const contentSchema = z.object({
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
});

export default function Editor() {
  const [activeTab, setActiveTab] = useState<"content" | "products" | "orders">("content");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const { data: content, isLoading: contentLoading } = useGetContent();
  const { data: products } = useListProducts();
  const { data: orders } = useListOrders();

  const updateContent = useUpdateContent();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  
  const queryClient = useQueryClient();

  // --- Content Form ---
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
      active: product.active
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

  if (contentLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-20 font-sans">
      <header className="bg-white border-b border-black/10 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="w-8 h-8 bg-black rounded-full block"></Link>
            <h1 className="font-bold text-xl tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" asChild className="rounded-none border-black/20 hover:bg-black/5">
              <Link href="/">View Site</Link>
            </Button>
            {activeTab === "content" && (
              <Button 
                onClick={contentForm.handleSubmit(onContentSubmit)}
                disabled={updateContent.isPending}
                className="rounded-none bg-black text-white hover:bg-black/80 uppercase tracking-widest text-xs font-bold"
              >
                {updateContent.isPending ? "Saving..." : "Save Content"}
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
                        <div className="space-y-1 leading-none"><FormLabel>Active in Store</FormLabel></div>
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
                          {!p.active && <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Hidden</span>}
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
                      <td className="py-4 px-4">{formatPrice(o.totalCents, o.currency)}</td>
                      <td className="py-4 px-4">
                        <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Button asChild variant="ghost" size="sm" className="rounded-none text-xs uppercase tracking-widest font-bold">
                          <Link href={`/order/${o.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!orders || orders.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-black/50">No orders yet.</td>
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
