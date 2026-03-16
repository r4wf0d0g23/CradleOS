import { useContext } from "react";
import { SmartObjectContext } from "../providers/SmartObjectProvider";
import { SmartObjectContextType } from "../types";

/**
 * Hook for accessing smart assembly data from the Sui GraphQL Indexer.
 *
 * Provides reactive access to the currently selected smart assembly (Smart Storage Unit,
 * Smart Turret, Smart Gate, Network Node, etc.) with automatic polling for updates.
 * The assembly ID is determined from URL query parameters (`?itemId=` and `?tenant=`)
 * or environment variables as a Sui object ID (`VITE_OBJECT_ID`).
 *
 * @category Hooks - Smart Object
 * @returns Object containing assembly state and methods:
 *   - `assembly` - The transformed assembly data (or null if not loaded)
 *   - `character` - The owner character information (or null)
 *   - `loading` - Boolean indicating if data is being fetched
 *   - `error` - Error message string (or null)
 *   - `refetch` - Function to manually refresh assembly data
 * @throws {Error} If used outside of `EveFrontierProvider`
 *
 * @example Basic usage
 * ```tsx
 * import { useSmartObject } from '@evefrontier/dapp-kit';
 *
 * const AssemblyInfo = () => {
 *   const { assembly, loading, error, refetch } = useSmartObject();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!assembly) return <div>No assembly found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{assembly.name}</h1>
 *       <p>Type: {assembly.type}</p>
 *       <p>State: {assembly.state}</p>
 *       <p>ID: {assembly.id}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example Accessing owner character
 * ```tsx
 * const { assembly, character } = useSmartObject();
 *
 * return (
 *   <div>
 *     <p>Assembly: {assembly?.name}</p>
 *     <p>Owner: {character?.name || 'Unknown'}</p>
 *   </div>
 * );
 * ```
 *
 */
export function useSmartObject(): SmartObjectContextType {
  const context = useContext(SmartObjectContext);
  if (!context) {
    throw new Error(
      "useSmartObject must be used within an EveFrontierProvider",
    );
  }
  return context;
}
