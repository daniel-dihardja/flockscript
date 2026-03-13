"use client";

import { createContext, useContext, useState } from "react";

interface PatchContextValue {
  patch: string;
  setPatch: (json: string) => void;
}

const PatchContext = createContext<PatchContextValue | null>(null);

export function PatchProvider({ children }: { children: React.ReactNode }) {
  const [patch, setPatch] = useState<string>("{}");

  return (
    <PatchContext.Provider value={{ patch, setPatch }}>
      {children}
    </PatchContext.Provider>
  );
}

export function usePatch(): PatchContextValue {
  const ctx = useContext(PatchContext);
  if (!ctx) {
    throw new Error("usePatch must be used within a PatchProvider");
  }
  return ctx;
}
