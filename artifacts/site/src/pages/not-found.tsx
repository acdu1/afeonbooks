import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF7F2] px-6">
      <main className="w-full max-w-lg border border-black/10 bg-white p-10 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-[#E2553B]" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-black/40">Error 404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-black">Page not found</h1>
        <p className="mt-4 text-black/60">The page you requested does not exist or may have moved.</p>
        <Button asChild className="mt-8 rounded-none bg-black px-8 text-white hover:bg-[#E2553B]">
          <Link href="/">Return home</Link>
        </Button>
      </main>
    </div>
  );
}
