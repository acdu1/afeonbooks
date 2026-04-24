import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useGetContent, useUpdateContent, useListPreorders, getGetContentQueryKey } from "@workspace/api-client-react";

const editorSchema = z.object({
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
});

export default function Editor() {
  const { data: content, isLoading } = useGetContent();
  const { data: preorders } = useListPreorders();
  const updateContent = useUpdateContent();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof editorSchema>>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      brandName: "",
      navHomeLabel: "",
      heroTitle: "",
      heroSubtitle: "",
      ctaLabel: "",
      ctaUrl: "",
      coverImageUrl: "",
      aboutHeading: "",
      aboutBody: "",
      authorsLine: "",
      illustratorLine: "",
      footerNote: "",
      accentColor: "#E76F51",
    },
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (content && !initialized.current) {
      form.reset({
        brandName: content.brandName,
        navHomeLabel: content.navHomeLabel,
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        ctaLabel: content.ctaLabel,
        ctaUrl: content.ctaUrl,
        coverImageUrl: content.coverImageUrl,
        aboutHeading: content.aboutHeading,
        aboutBody: content.aboutBody,
        authorsLine: content.authorsLine,
        illustratorLine: content.illustratorLine,
        footerNote: content.footerNote,
        accentColor: content.accentColor,
      });
      initialized.current = true;
    }
  }, [content, form]);

  const onSubmit = (values: z.infer<typeof editorSchema>) => {
    updateContent.mutate({ data: values }, {
      onSuccess: (data) => {
        toast.success("Site content saved!");
        queryClient.setQueryData(getGetContentQueryKey(), data);
      },
      onError: () => {
        toast.error("Failed to save site content.");
      }
    });
  };

  const coverImageUrl = form.watch("coverImageUrl");

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="bg-background border-b border-border sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold">Site Editor</h1>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/">View Site</Link>
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={updateContent.isPending}
            >
              {updateContent.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <Form {...form}>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              {/* General Settings */}
              <div className="bg-background border rounded-xl p-6 shadow-sm space-y-6">
                <h2 className="font-serif text-lg font-bold border-b pb-2">General</h2>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brandName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="navHomeLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nav Home Label</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accentColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accent Color (Hex)</FormLabel>
                        <div className="flex gap-2">
                          <FormControl><Input type="color" className="w-12 h-10 p-1" {...field} /></FormControl>
                          <FormControl><Input {...field} /></FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="footerNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Note</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Hero Settings */}
              <div className="bg-background border rounded-xl p-6 shadow-sm space-y-6">
                <h2 className="font-serif text-lg font-bold border-b pb-2">Hero Section</h2>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="heroTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hero Title</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heroSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hero Subtitle</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ctaLabel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CTA Label</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ctaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CTA URL</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* About Settings */}
              <div className="bg-background border rounded-xl p-6 shadow-sm space-y-6">
                <h2 className="font-serif text-lg font-bold border-b pb-2">About Section</h2>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="aboutHeading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About Heading</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="aboutBody"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About Body</FormLabel>
                        <FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="authorsLine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authors Line</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="illustratorLine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Illustrator Line</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar (Cover Image Preview) */}
            <div className="space-y-8">
              <div className="bg-background border rounded-xl p-6 shadow-sm space-y-6 sticky top-24">
                <h2 className="font-serif text-lg font-bold border-b pb-2">Cover Image</h2>
                <FormField
                  control={form.control}
                  name="coverImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl><Input type="url" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {coverImageUrl && (
                  <div className="mt-4 rounded-lg overflow-hidden border border-border shadow-sm">
                    <img 
                      src={coverImageUrl} 
                      alt="Cover Preview" 
                      className="w-full h-auto object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/400x600?text=Invalid+Image+URL";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </form>
        </Form>

        {/* Recent Preorders (Read-only) */}
        <div className="bg-background border rounded-xl p-6 shadow-sm space-y-6">
          <h2 className="font-serif text-lg font-bold border-b pb-2">Recent Preorders</h2>
          {preorders && preorders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground rounded-tl-md">Date</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Copies</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground rounded-tr-md">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preorders.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                      <td className="px-4 py-3">{p.quantity}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={p.message}>
                        {p.message || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center italic">No preorders yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
