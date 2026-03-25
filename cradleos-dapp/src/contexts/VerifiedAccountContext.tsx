// VerifiedAccountContext.tsx
// Provides verified account state to all panels via React context.
// Wrap the app in <VerifiedAccountProvider> once — all panels share the same
// verification state and won't each trigger their own signature popups.

import { createContext, useContext, type ReactNode } from "react";
import {
  useVerifiedAccount,
  type UseVerifiedAccountResult,
} from "../hooks/useVerifiedAccount";

const VerifiedAccountContext = createContext<UseVerifiedAccountResult | null>(null);

export function VerifiedAccountProvider({ children }: { children: ReactNode }) {
  const value = useVerifiedAccount();
  return (
    <VerifiedAccountContext.Provider value={value}>
      {children}
    </VerifiedAccountContext.Provider>
  );
}

// Re-export the type so panels can import it from here
export type { UseVerifiedAccountResult };

export function useVerifiedAccountContext(): UseVerifiedAccountResult {
  const ctx = useContext(VerifiedAccountContext);
  if (!ctx) {
    throw new Error(
      "useVerifiedAccountContext must be used inside <VerifiedAccountProvider>"
    );
  }
  return ctx;
}
