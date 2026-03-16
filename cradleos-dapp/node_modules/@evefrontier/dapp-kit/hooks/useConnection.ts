import { useContext } from "react";
import { VaultContext } from "../providers/VaultProvider";
import { VaultContextType } from "../types";

/**
 * Hook for managing wallet connection state in EVE Frontier dApps.
 *
 * Provides access to wallet connection status, current account information,
 * and methods to connect/disconnect wallets. Automatically detects EVE Vault
 * wallet availability.
 *
 * @category Hooks - Connection
 * @returns Object containing wallet state and connection methods:
 *   - `currentAccount` - The currently connected wallet account (or null)
 *   - `walletAddress` - The connected wallet's address string
 *   - `isConnected` - Boolean indicating connection status
 *   - `hasEveVault` - Boolean indicating if EVE Vault wallet is available
 *   - `handleConnect` - Function to initiate wallet connection
 *   - `handleDisconnect` - Function to disconnect the wallet
 * @throws {Error} If used outside of `EveFrontierProvider`
 *
 * @example Basic usage
 * ```tsx
 * import { useConnection } from '@evefrontier/dapp-kit';
 *
 * const WalletButton = () => {
 *   const { isConnected, walletAddress, handleConnect, handleDisconnect } = useConnection();
 *
 *   if (isConnected) {
 *     return (
 *       <div>
 *         <p>Connected: {walletAddress}</p>
 *         <button onClick={handleDisconnect}>Disconnect</button>
 *       </div>
 *     );
 *   }
 *
 *   return <button onClick={handleConnect}>Connect Wallet</button>;
 * };
 * ```
 *
 * @example Check for EVE Vault
 * ```tsx
 * const { hasEveVault, handleConnect } = useConnection();
 *
 * return (
 *   <button onClick={handleConnect} disabled={!hasEveVault}>
 *     {hasEveVault ? 'Connect EVE Vault' : 'Please install EVE Vault'}
 *   </button>
 * );
 * ```
 */
export function useConnection(): VaultContextType {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useConnection must be used within an EveFrontierProvider");
  }
  return context;
}
