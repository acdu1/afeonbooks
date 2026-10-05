import React, { createContext, useContext, useState } from "react";
import type { SchoolParameter } from "@workspace/api-client-react";

export const SCHOOL_OPTIONS = {
  alvarado: { label: "Alvarado Intermediate", short: "Alvarado" },
} as const;

type School = SchoolParameter;
type SchoolContextValue = { school: School; chooseSchool: (school: School) => void; changeSchool: () => void };
const DEFAULT_SCHOOL: School = "alvarado";
const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<School>(() => {
    localStorage.setItem("afeon_school", DEFAULT_SCHOOL);
    return DEFAULT_SCHOOL;
  });
  const chooseSchool = () => { localStorage.setItem("afeon_school", DEFAULT_SCHOOL); setSchool(DEFAULT_SCHOOL); };
  const changeSchool = () => { localStorage.setItem("afeon_school", DEFAULT_SCHOOL); setSchool(DEFAULT_SCHOOL); };
  return <SchoolContext.Provider value={{ school, chooseSchool, changeSchool }}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  const value = useContext(SchoolContext);
  if (!value) throw new Error("useSchool must be used within SchoolProvider");
  return value;
}
