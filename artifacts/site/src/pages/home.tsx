import { Link } from "wouter";
import { useGetContent, useCreatePreorder, useGetPreordersSummary, getGetPreordersSummaryQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";

const preorderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  quantity: z.coerce.number().min(1, "Must order at least 1 copy"),
  message: z.string().optional(),
});

export default function Home() {
  const { data: content, isLoading } = useGetContent();
  const { data: summary } = useGetPreordersSummary();
  const createPreorder = useCreatePreorder();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof preorderSchema>>({
    resolver: zodResolver(preorderSchema),
    defaultValues: {
      name: "",
      email: "",
      quantity: 1,
      message: "",
    },
  });

  const onSubmit = (values: z.infer<typeof preorderSchema>) => {
    createPreorder.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Preorder submitted successfully!");
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetPreordersSummaryQueryKey() });
      },
      onError: () => {
        toast.error("Failed to submit preorder. Please try again.");
      }
    });
  };

  const scrollToPreorder = () => {
    const el = document.getElementById("preorder");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isLoading || !content) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF7F2]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans"
      style={{ "--theme-accent": content.accentColor, backgroundColor: "#FAF7F2" } as React.CSSProperties}
    >
      {/* Minimal Header */}
      <header className="px-6 py-8">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="w-9 h-9 bg-black rounded-full" aria-label="Logo"></div>
          <nav className="flex items-center gap-8 text-black">
            <Link href="/" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
              Home
            </Link>
            <div className="relative cursor-pointer hover:opacity-70 transition-opacity">
              <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
              <span className="absolute -top-1.5 -right-2 bg-transparent text-[11px] font-bold">0</span>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero Section */}
        <section className="w-full min-h-[85vh] flex items-center">
          <div className="w-full max-w-[1600px] mx-auto flex flex-col md:flex-row items-stretch md:items-center">
            {/* Left Column - Text */}
            <div className="w-full md:w-[45%] px-6 md:pl-[12%] py-12 md:py-0 flex flex-col justify-center z-10">
              <h1 className="text-black text-6xl md:text-[5.5rem] lg:text-[6.5rem] font-bold leading-[1.05] tracking-tight">
                {content.heroTitle}
              </h1>
              <p className="mt-8 text-black/60 text-base md:text-lg max-w-sm font-medium">
                {content.heroSubtitle}
              </p>
              <div className="mt-12">
                <Button 
                  size="lg" 
                  onClick={scrollToPreorder}
                  className="rounded-full bg-white text-black border border-black hover:text-white transition-all duration-300 px-12 py-7 text-[15px] tracking-wide font-medium shadow-none h-auto w-fit hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)]"
                >
                  {content.ctaLabel}
                </Button>
              </div>
            </div>
            
            {/* Right Column - Image */}
            <div className="w-full md:w-[55%] flex justify-center items-center px-6 md:px-0 pb-12 md:pb-0 h-[60vh] md:h-[85vh]">
              <img 
                src={content.coverImageUrl} 
                alt="Book Cover" 
                className="w-full h-full object-contain max-h-[800px]"
              />
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="px-6 py-32 bg-white">
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black">
              {content.aboutHeading}
            </h2>
            <div className="text-lg md:text-xl text-black/70 leading-relaxed font-medium">
              <p>{content.aboutBody}</p>
            </div>
            <div className="pt-12 flex flex-col sm:flex-row justify-center gap-4 sm:gap-12 text-sm text-black/50 uppercase tracking-widest font-bold">
              <span>By {content.authorsLine}</span>
              <span>Illustrated by {content.illustratorLine}</span>
            </div>
          </div>
        </section>

        {/* Preorder Section */}
        <section id="preorder" className="px-6 py-32 bg-[#FAF7F2]">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black">Reserve Your Copy</h2>
              <p className="text-black/60 text-lg">Be among the first to get this charming story.</p>
              
              {summary && summary.totalOrders > 0 && (
                <div className="inline-flex items-center gap-2 mt-6 text-sm font-bold tracking-widest uppercase text-black/40">
                  {summary.totalOrders} readers · {summary.totalCopies} copies pledged
                </div>
              )}
            </div>

            <div className="bg-white rounded-none p-8 md:p-12 shadow-sm border border-black/5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              placeholder="Full Name" 
                              {...field} 
                              className="bg-transparent border-0 border-b border-black/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-black text-lg h-12 shadow-none placeholder:text-black/30" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="Email Address" 
                              {...field} 
                              className="bg-transparent border-0 border-b border-black/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-black text-lg h-12 shadow-none placeholder:text-black/30" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            placeholder="Number of Copies" 
                            {...field} 
                            className="bg-transparent border-0 border-b border-black/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-black text-lg h-12 shadow-none placeholder:text-black/30" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Message for the Authors (Optional)" 
                            {...field} 
                            className="bg-transparent border-0 border-b border-black/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-black text-lg min-h-[100px] shadow-none placeholder:text-black/30 resize-none" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-8">
                    <Button 
                      type="submit" 
                      className="w-full py-8 text-base tracking-wide rounded-none bg-black text-white hover:bg-[var(--theme-accent)] hover:border-[var(--theme-accent)] transition-colors uppercase font-bold shadow-none"
                      disabled={createPreorder.isPending}
                    >
                      {createPreorder.isPending ? "Submitting..." : "Complete Preorder"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-black/5 py-16 text-center text-black/40">
        <p className="text-sm font-medium tracking-wide">{content.footerNote}</p>
        <div className="mt-8">
          <Link href="/editor" className="text-[11px] uppercase tracking-widest font-bold hover:text-black transition-colors">
            Admin Area
          </Link>
        </div>
      </footer>
    </div>
  );
}
