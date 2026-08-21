import React, { createContext, useContext, useState } from "react";
import type { SchoolParameter } from "@workspace/api-client-react";

export const SCHOOL_OPTIONS = {
  alvarado: { label: "Alvarado Intermediate", short: "Alvarado" },
  shelyn: { label: "Shelyn Elementary", short: "Shelyn" },
} as const;

type School = SchoolParameter;
type SchoolContextValue = { school: School | null; chooseSchool: (school: School) => void; changeSchool: () => void };
const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School | null>(() => {
    const stored = localStorage.getItem("afeon_school");
    return stored === "shelyn" || stored === "alvarado" ? stored : null;
  });
  const chooseSchool = (next: School) => { localStorage.setItem("afeon_school", next); setSchool(next); };
  const changeSchool = () => { localStorage.removeItem("afeon_school"); setSchool(null); };
  return <SchoolContext.Provider value={{ school, chooseSchool, changeSchool }}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  const value = useContext(SchoolContext);
  if (!value) throw new Error("useSchool must be used within SchoolProvider");
  return value;
}