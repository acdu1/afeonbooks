import React, { createContext, useContext } from "react";

// AFEON Books is now a single storefront. This compatibility layer keeps
// existing imports from breaking while removing all school selection logic.
type School = null;
type SchoolContextValue = {
  school: School;
  chooseSchool: () => void;
  changeSchool: () => void;
};

const SchoolContext = createContext<SchoolContextValue>({
  school: null,
  chooseSchool: () => {},
  changeSchool: () => {},
});

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  return (
    <SchoolContext.Provider value={{ school: null, chooseSchool: () => {}, changeSchool: () => {} }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
