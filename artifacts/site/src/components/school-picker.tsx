import { useSchool, SCHOOL_OPTIONS } from "@/lib/school";
import { Button } from "@/components/ui/button";

export function SchoolPicker() {
  const { school, chooseSchool } = useSchool();
  if (school) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-[#FAF7F2] p-8 md:p-12 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.25em] font-bold text-black/50 mb-4">AFEON Books</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Choose your school</h1>
        <p className="text-black/60 mb-8">Select your school to see the right books and delivery information.</p>
        <div className="grid gap-4">
          {(Object.entries(SCHOOL_OPTIONS) as [keyof typeof SCHOOL_OPTIONS, typeof SCHOOL_OPTIONS.alvarado][]).map(([key, option]) => (
            <Button key={key} onClick={() => chooseSchool(key)} className="h-16 rounded-none bg-black hover:bg-[#E2553B] text-white justify-between px-6 text-base">
              <span>{option.label}</span><span aria-hidden>→</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}