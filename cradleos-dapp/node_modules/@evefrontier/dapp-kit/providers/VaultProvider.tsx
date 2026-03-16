import { ReactNode, useRef, useEffect, createContext } from "react";
import {
  useCurrentAccount,
  useWallets,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { STORAGE_KEYS } from "../utils";
import { SupportedWallets, VaultContextType } from "../types";

/** @category Providers */
export const VaultContext = createContext<VaultContextType>({
  currentAccount: null,
  walletAddress: undefined,
  hasEveVault: false,
  isConnected: false,
  handleConnect: () => {},
  handleDisconnect: () => {},
});

/**
 * VaultProvider component provides a context for managing Sui wallet connections.
 * It uses @mysten/dapp-kit-react hooks for wallet management.
 */
// Module-level flag to prevent auto-connect from running multiple times
// (persists across component remounts caused by wallet state changes)
let globalAutoConnectAttempted = false;

/** @category Providers */
const VaultProvider = ({ children }: { children: ReactNode }) => {
  // Sui dapp-kit hooks
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { connectWallet, disconnectWallet } = dAppKit;
  const wallets = useWallets();

  // Find Eve Vault wallet if available
  const eveVaultWallet = wallets.find(
    (wallet) =>
      wallet.name.includes(SupportedWallets.EVE_FRONTIER_CLIENT_WALLET) ||
      wallet.name.includes(SupportedWallets.EVE_VAULT),
  );

  // Track if auto-connect has been attempted to prevent infinite loops
  const hasAttemptedAutoConnect = useRef(false);

  const handleConnect = () => {
    const walletToConnect = eveVaultWallet || wallets[0];

    if (!walletToConnect) {
      console.warn("No wallet available to connect");
      return;
    }

    try {
      connectWallet({ wallet: walletToConnect });
      console.log("[DappKit] Connected to wallet:", walletToConnect.name);
      localStorage.setItem(STORAGE_KEYS.CONNECTED, "true");
    } catch (error) {
      console.error("[DappKit] Failed to connect wallet:", error);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    localStorage.removeItem(STORAGE_KEYS.CONNECTED);
    console.log("[DappKit] Wallet disconnected");
  };

  // Auto-reconnect if user was previously connected (only once)
  useEffect(() => {
    // Use both local ref AND global flag for maximum protection against re-render loops
    if (hasAttemptedAutoConnect.current || globalAutoConnectAttempted) return;

    const isPreviouslyConnected =
      localStorage.getItem(STORAGE_KEYS.CONNECTED) === "true";

    if (
      typeof window !== "undefined" &&
      isPreviouslyConnected &&
      eveVaultWallet
    ) {
      hasAttemptedAutoConnect.current = true;
      globalAutoConnectAttempted = true;
      handleConnect();
    }
  }, [eveVaultWallet, handleConnect]);

  const isConnected = !!currentAccount;

  return (
    <VaultContext.Provider
      value={{
        walletAddress: currentAccount?.address,
        currentAccount,
        hasEveVault: !!eveVaultWallet,
        isConnected,
        handleConnect,
        handleDisconnect,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export default VaultProvider;
