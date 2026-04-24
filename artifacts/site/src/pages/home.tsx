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
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground font-serif italic">Loading storybook...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col"
      style={{ "--theme-accent": content.accentColor } as React.CSSProperties}
    >
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="font-serif font-bold text-xl tracking-tight" style={{ color: "var(--theme-accent)" }}>
            {content.brandName}
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-foreground/80 transition-colors">
              {content.navHomeLabel}
            </Link>
            <Button 
              onClick={scrollToPreorder} 
              className="rounded-full shadow-sm hover:shadow-md transition-all font-serif"
              style={{ backgroundColor: "var(--theme-accent)", color: "#fff" }}
            >
              Preorder Now
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-6 py-16 md:py-24 lg:py-32">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 order-2 md:order-1 text-center md:text-left">
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-foreground">
                {content.heroTitle}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0 font-medium leading-relaxed">
                {content.heroSubtitle}
              </p>
              <div className="pt-4">
                <Button 
                  size="lg" 
                  onClick={scrollToPreorder}
                  className="rounded-full text-lg px-8 py-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 font-serif"
                  style={{ backgroundColor: "var(--theme-accent)", color: "#fff" }}
                >
                  {content.ctaLabel}
                </Button>
              </div>
            </div>
            
            <div className="order-1 md:order-2 relative mx-auto w-full max-w-[400px]">
              <div className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl" style={{ backgroundColor: "var(--theme-accent)" }}></div>
              <img 
                src={content.coverImageUrl} 
                alt="Book Cover" 
                className="w-full h-auto rounded-xl shadow-2xl relative z-10 rotate-2 hover:rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="px-6 py-20 bg-black/[0.02]">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="font-serif text-3xl md:text-4xl font-bold" style={{ color: "var(--theme-accent)" }}>
              {content.aboutHeading}
            </h2>
            <div className="prose prose-lg mx-auto text-muted-foreground leading-relaxed">
              <p>{content.aboutBody}</p>
            </div>
            <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-center gap-4 sm:gap-12 text-sm font-serif italic text-muted-foreground">
              <span>By {content.authorsLine}</span>
              <span>Illustrated by {content.illustratorLine}</span>
            </div>
          </div>
        </section>

        {/* Preorder Section */}
        <section id="preorder" className="px-6 py-24">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-10 space-y-4">
              <h2 className="font-serif text-3xl md:text-4xl font-bold">Reserve Your Copy</h2>
              <p className="text-muted-foreground">Be among the first to get this charming story.</p>
              
              {summary && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 text-sm font-medium border border-border/50">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--theme-accent)" }}></span>
                  Joined {summary.totalOrders} readers · {summary.totalCopies} copies pledged
                </div>
              )}
            </div>

            <div className="bg-card border border-border shadow-xl rounded-2xl p-6 md:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-serif">Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} className="bg-background" />
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
                          <FormLabel className="font-serif">Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="jane@example.com" {...field} className="bg-background" />
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
                        <FormLabel className="font-serif">Number of Copies</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} className="bg-background" />
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
                        <FormLabel className="font-serif">Message for the Authors (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Can't wait to read this to my kids!" {...field} className="bg-background min-h-[100px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full py-6 text-lg rounded-xl shadow-md transition-all hover:shadow-lg font-serif"
                    style={{ backgroundColor: "var(--theme-accent)", color: "#fff" }}
                    disabled={createPreorder.isPending}
                  >
                    {createPreorder.isPending ? "Submitting..." : "Complete Preorder"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12 text-center text-muted-foreground">
        <p className="font-serif text-sm">{content.footerNote}</p>
        <div className="mt-4">
          <Link href="/editor" className="text-xs hover:underline opacity-50 hover:opacity-100 transition-opacity">
            Admin Area
          </Link>
        </div>
      </footer>
    </div>
  );
}
