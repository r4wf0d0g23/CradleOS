import {
  ReactNode,
  useState,
  createContext,
  useEffect,
  useCallback,
  useRef,
} from "react";

import {
  Assemblies,
  AssemblyType,
  QueryParams,
  DetailedSmartCharacterResponse,
} from "../types";

import { DEFAULT_TENANT, POLLING_INTERVAL } from "../utils/constants";
import { getAssemblyWithOwner, MoveObjectData } from "../graphql";
import {
  getObjectId,
  transformToAssembly,
  transformToCharacter,
} from "../utils";
import { getDatahubGameInfo } from "../utils/datahub";
import { useConnection } from "../hooks/useConnection";
import { SmartObjectContextType } from "../types";

/** Input for fetching object data: either itemId + tenant (derive object ID) or a Sui object ID directly.
 * @category Types
 */
export type FetchObjectDataInput =
  | { itemId: string; selectedTenant: string }
  | { objectId: string };

/** @category Providers */
export const SmartObjectContext = createContext<SmartObjectContextType>({
  tenant: DEFAULT_TENANT,
  assembly: null,
  assemblyOwner: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

/**
 * SmartObjectProvider component provides context for smart objects data.
 * It uses GraphQL queries to fetch objects on the Sui blockchain
 * from the EVE Frontier package, with optional polling for updates.
 *
 * The provider fetches both the assembly data and its owner (assemblyOwner) information:
 * 1. Fetches assembly data with dynamic fields
 * 2. Uses owner_cap_id to resolve the Character OwnerCap
 * 3. Fetches full assemblyOwner data from the Character ID
 *
 * @category Providers
 */
const SmartObjectProvider = ({ children }: { children: ReactNode }) => {
  const [assembly, setAssembly] = useState<AssemblyType<Assemblies> | null>(
    null,
  );
  const [assemblyOwner, setAssemblyOwner] =
    useState<DetailedSmartCharacterResponse | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [isObjectIdDirect, setIsObjectIdDirect] = useState<boolean>(false); // Whether selectedObjectId is a Sui object ID or derived from itemId + tenant.
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string | null>(null);

  const { isConnected } = useConnection();

  // Fetch object data with owner/assemblyOwner info.
  // Accepts either { itemId, selectedTenant } (derive Sui object ID) or { objectId } (use directly).
  const fetchObjectData = useCallback(
    async (input: FetchObjectDataInput, isInitialFetch = false) => {
      const hasItemId = "itemId" in input && "selectedTenant" in input;
      if (hasItemId) {
        if (!input.itemId || !input.selectedTenant) return;
      } else {
        if (!input.objectId) return;
      }

      if (isInitialFetch) {
        setLoading(true);
      }
      setError(null);

      try {
        const objectId = hasItemId
          ? await getObjectId(input.itemId, input.selectedTenant)
          : input.objectId;
        console.log(
          "[DappKit] SmartObjectProvider: Fetching object:",
          hasItemId
            ? { itemId: input.itemId, selectedTenant: input.selectedTenant }
            : { objectId },
        );

        // Fetch both assembly and assemblyOwner data
        const {
          moveObject,
          assemblyOwner: characterInfo,
          energySource,
          destinationGate,
        } = await getAssemblyWithOwner(objectId);

        if (!moveObject) {
          console.warn(
            "[DappKit] SmartObjectProvider: Object not found or not a Move object",
          );
          setAssembly(null);
          setAssemblyOwner(null);
          setError("Object not found or not a Move object");
          return;
        }

        // Create a hash of the data to check for changes
        const dataHash = JSON.stringify({
          moveObject,
          assemblyOwner: characterInfo,
          energySource,
        });

        // Only update state if the data changed (optimization for polling)
        if (isInitialFetch || lastDataHashRef.current !== dataHash) {
          console.log("[DappKit] SmartObjectProvider: Object data updated");
          lastDataHashRef.current = dataHash;

          // Extract typeId from the raw JSON to fetch datahub info
          const rawJson = moveObject.contents?.json as
            | { type_id?: string; status?: { type_id?: string } }
            | undefined;
          const typeId = rawJson?.type_id || rawJson?.status?.type_id || "0";

          // Fetch datahub game info (name, description, image defaults)
          let datahubInfo = null;
          try {
            datahubInfo = await getDatahubGameInfo(parseInt(typeId, 10));
          } catch (err) {
            console.warn(
              "[DappKit] SmartObjectProvider: Failed to fetch datahub info:",
              err,
            );
          }

          // Transform assembly with assemblyOwner and datahub info
          const transformed = await transformToAssembly(
            objectId,
            moveObject as MoveObjectData,
            {
              character: characterInfo,
              datahubInfo,
              energySource: energySource,
              destinationGate: destinationGate,
            },
          );

          setAssembly(transformed);

          // Transform and set assemblyOwner: owner of the assembly
          if (characterInfo) {
            const transformedCharacter = transformToCharacter(characterInfo);
            setAssemblyOwner(transformedCharacter);
          } else {
            setAssemblyOwner(null);
          }
        }
        setError(null);
      } catch (err: unknown) {
        console.error("[DappKit] SmartObjectProvider: Query error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch object");
      } finally {
        if (isInitialFetch) {
          setLoading(false);
        }
      }
    },
    [],
  );

  // Initialize the object ID (env or query params) and tenant (query params).
  // Tenant comes from URL ?tenant= with fallback DEFAULT_TENANT.
  useEffect(() => {
    console.log("[DappKit] SmartObjectProvider: Checking for item ID");

    const queryParams = new URLSearchParams(window.location.search);
    const queryTenant =
      queryParams.get(QueryParams.TENANT)?.trim() || DEFAULT_TENANT;

    // Check if an object ID exists in the .env file
    const envObjectId = import.meta.env.VITE_OBJECT_ID;

    if (envObjectId) {
      console.log(
        "[DappKit] SmartObjectProvider: Using Sui object ID from env:",
        envObjectId,
      );
      setSelectedObjectId(envObjectId);
      setSelectedTenant(queryTenant);
      setIsObjectIdDirect(true);
      return;
    }

    // Else, derive object ID from item ID and tenant and passed via query param
    const queryItemId = queryParams.get(QueryParams.ITEM_ID);

    if (queryItemId) {
      setSelectedObjectId(queryItemId);
      setSelectedTenant(queryTenant);
      setIsObjectIdDirect(false);
    } else {
      console.error("[DappKit] SmartObjectProvider: No object ID provided");
      setLoading(false);
    }
  }, []);

  // Fetch and poll for object data
  useEffect(() => {
    if (!selectedObjectId || !isConnected) {
      setLoading(false);
      return;
    }

    const input: FetchObjectDataInput = isObjectIdDirect
      ? { objectId: selectedObjectId }
      : { itemId: selectedObjectId, selectedTenant };

    // Initial fetch
    fetchObjectData(input, true);

    // Set up polling
    pollingRef.current = setInterval(() => {
      fetchObjectData(input, false);
    }, POLLING_INTERVAL);

    console.log(
      "[DappKit] SmartObjectProvider: Started polling for object:",
      selectedObjectId,
    );

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        console.log("[DappKit] SmartObjectProvider: Stopped polling");
      }
      lastDataHashRef.current = null;
    };
  }, [
    selectedObjectId,
    selectedTenant,
    isObjectIdDirect,
    isConnected,
    fetchObjectData,
  ]);

  const handleRefetch = useCallback(async () => {
    if (!selectedObjectId) return;
    const input: FetchObjectDataInput = isObjectIdDirect
      ? { objectId: selectedObjectId }
      : { itemId: selectedObjectId, selectedTenant };
    await fetchObjectData(input, true);
  }, [selectedObjectId, selectedTenant, isObjectIdDirect, fetchObjectData]);

  return (
    <SmartObjectContext.Provider
      value={{
        tenant: selectedTenant,
        assembly,
        assemblyOwner,
        loading,
        error,
        refetch: handleRefetch,
      }}
    >
      {children}
    </SmartObjectContext.Provider>
  );
};

export default SmartObjectProvider;
