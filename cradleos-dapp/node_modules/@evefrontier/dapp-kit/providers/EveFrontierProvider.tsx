import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { dAppKit } from "../config/dapp-kit";

import NotificationProvider from "./NotificationProvider";
import SmartObjectProvider from "./SmartObjectProvider";
import VaultProvider from "./VaultProvider";
/**
 * EveFrontierProvider wraps the application with all necessary providers
 * for the EVE Frontier dApp kit.
 *
 * Provider hierarchy:
 * 1. QueryClientProvider - React Query for async state management
 * 2. DAppKitProvider - Sui blockchain client
 * 3. VaultProvider - Eve-specific wallet configuration  (from @evefrontier/dapp-kit)
 * 4. SmartObjectProvider - Smart object data via GraphQL
 * 5. NotificationProvider - User notifications
 * @category Providers
 */
const EveFrontierProvider = ({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <VaultProvider>
          <SmartObjectProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </SmartObjectProvider>
        </VaultProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
};

export default EveFrontierProvider;
