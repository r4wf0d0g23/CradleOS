import { WalletAccount } from "@mysten/wallet-standard";
import {
  Assemblies,
  AssemblyType,
  DetailedSmartCharacterResponse,
  Severity,
} from "./types";

/**
 * Vault context: account, connection state, and connect/disconnect handlers.
 * @category Types
 */
export interface VaultContextType {
  currentAccount: WalletAccount | null;
  walletAddress: string | undefined;
  hasEveVault: boolean;
  isConnected: boolean;
  handleConnect: () => void;
  handleDisconnect: () => void;
}

export enum SupportedWallets {
  EVE_VAULT = "Eve Vault",
  EVE_FRONTIER_CLIENT_WALLET = "EVE Frontier Client Wallet",
}

/**
 * Smart object context: assembly, owner, loading, error, and refetch.
 * @category Types
 */
export interface SmartObjectContextType {
  tenant: string;
  assembly: AssemblyType<Assemblies> | null;
  assemblyOwner: DetailedSmartCharacterResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** @category Types */
export interface NotificationContextType {
  notify: (notification: {
    type: Severity;
    txHash?: string;
    message?: string;
  }) => void;
  notification: NotificationState;
  handleClose: () => void;
}

/** @category Types */
export interface NotificationState {
  message: string;
  txHash: string;
  severity: Severity;
  handleClose: () => void;
  isOpen: boolean;
}
