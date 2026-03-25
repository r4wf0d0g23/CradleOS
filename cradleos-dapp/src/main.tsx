import React from "react";
import ReactDOM from "react-dom/client";

// crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
// The EVE Vault injected.js calls it during wallet connect — polyfill for LAN/http.
if (typeof crypto.randomUUID !== "function") {
  (crypto as any).randomUUID = (): string => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return [...b].map((v, i) =>
      ([4,6,8,10].includes(i) ? "-" : "") + v.toString(16).padStart(2,"0")
    ).join("");
  };
}
import "./main.css";
import "@radix-ui/themes/styles.css";

import { QueryClient } from "@tanstack/react-query";
import App from "./App";
import { EveFrontierProvider } from "@evefrontier/dapp-kit";
import { Theme } from "@radix-ui/themes";

// EVE Vault v0.0.6 registers itself via Wallet Standard through its content script.
// No manual registration needed — useWallets() picks it up automatically.

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="orange" grayColor="sand">
      <EveFrontierProvider queryClient={queryClient}>
        <App />
      </EveFrontierProvider>
    </Theme>
  </React.StrictMode>,
);
