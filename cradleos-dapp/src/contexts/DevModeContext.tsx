// DevModeContext.tsx
// DEV-only: lets you simulate what different user roles see.
// Only active in dev builds (import.meta.env.DEV). Has zero effect in production.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { VerifiedAccount } from "../hooks/useVerifiedAccount";

export type DevRole = "founder" | "member" | "tribeless" | "no-wallet";

const DEV_ROLES: DevRole[] = ["founder", "member", "tribeless", "no-wallet"];

const ROLE_LABELS: Record<DevRole, string> = {
  founder:   "Tribe Founder",
  member:    "Tribe Member",
  tribeless: "Tribeless",
  "no-wallet": "No Wallet",
};

interface DevModeContextValue {
  devRole: DevRole | null;       // null = real state
  setDevRole: (r: DevRole | null) => void;
  isDevActive: boolean;
}

const DevModeContext = createContext<DevModeContextValue>({
  devRole: null,
  setDevRole: () => {},
  isDevActive: false,
});

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devRole, setDevRole] = useState<DevRole | null>(null);
  return (
    <DevModeContext.Provider value={{ devRole, setDevRole, isDevActive: devRole !== null }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  return useContext(DevModeContext);
}

export { DEV_ROLES, ROLE_LABELS };

// ── Override helpers ────────────────────────────────────────────────────────
// Panels import useDevOverrides() to apply role overrides to their local state.

export function useDevOverrides() {
  const { devRole } = useDevMode();
  const active = import.meta.env.DEV && devRole !== null;

  return {
    /** Override the verified account: null for no-wallet mode */
    overrideAccount(real: VerifiedAccount | null): VerifiedAccount | null {
      if (!active) return real;
      if (devRole === "no-wallet") return null;
      return real; // use real address for all other modes
    },

    /** Override isFounder */
    overrideIsFounder(real: boolean): boolean {
      if (!active) return real;
      if (devRole === "founder") return true;
      if (devRole === "member" || devRole === "tribeless") return false;
      return false; // no-wallet
    },

    /** Override tribe ID lookup result */
    overrideTribeId(real: number | null): number | null {
      if (!active) return real;
      if (devRole === "tribeless" || devRole === "no-wallet") return null;
      return real; // keep real tribe for founder/member
    },

    /** Override isMember (anything with a wallet + tribe) */
    overrideIsMember(real: boolean): boolean {
      if (!active) return real;
      if (devRole === "founder" || devRole === "member") return true;
      return false;
    },

    devRole,
    active,
  };
}

// ── Dev role toggle bar (rendered in App.tsx header, DEV only) ──────────────
export function DevRoleToggle() {
  const { devRole, setDevRole } = useDevMode();

  if (!import.meta.env.DEV) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 0,
      background: "rgba(10,10,10,0.97)", borderTop: "1px solid rgba(255,71,0,0.4)",
      padding: "6px 12px",
    }}>
      <span style={{ fontSize: 9, color: "rgba(255,71,0,0.7)", fontFamily: "monospace",
        letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 10, flexShrink: 0 }}>
        DEV VIEW
      </span>
      {/* "Real" button */}
      <button
        onClick={() => setDevRole(null)}
        style={{
          fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em",
          textTransform: "uppercase", padding: "3px 10px", cursor: "pointer",
          background: devRole === null ? "#FF4700" : "transparent",
          color: devRole === null ? "#000" : "rgba(255,71,0,0.5)",
          border: "1px solid rgba(255,71,0,0.4)",
          borderRight: "none", fontWeight: devRole === null ? 800 : 400,
        }}
      >
        REAL
      </button>
      {DEV_ROLES.map((role, i) => (
        <button
          key={role}
          onClick={() => setDevRole(role)}
          style={{
            fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em",
            textTransform: "uppercase", padding: "3px 10px", cursor: "pointer",
            background: devRole === role ? "#FF4700" : "transparent",
            color: devRole === role ? "#000" : "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,71,0,0.4)",
            borderRight: i === DEV_ROLES.length - 1 ? "1px solid rgba(255,71,0,0.4)" : "none",
            fontWeight: devRole === role ? 800 : 400,
          }}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
      {import.meta.env.DEV && devRole && (
        <span style={{ fontSize: 9, color: "#ffd700", fontFamily: "monospace",
          marginLeft: 12, letterSpacing: "0.1em" }}>
          ⚠ SIMULATING: {ROLE_LABELS[devRole].toUpperCase()}
        </span>
      )}
    </div>
  );
}
