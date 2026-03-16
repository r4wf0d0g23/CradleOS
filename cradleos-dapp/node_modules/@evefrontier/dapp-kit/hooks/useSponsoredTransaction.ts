import { getWallets } from "@mysten/wallet-standard";
import {
  useCurrentAccount,
  useWallets,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import {
  useMutation,
  UseMutationResult,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  getAssemblyTypeApiString,
  supportsSponsoredTransaction,
  getSponsoredTransactionMethod,
  type SponsoredTransactionInput,
  type SponsoredTransactionOutput,
  SponsoredTransactionArgs,
} from "../wallet";
import { Assemblies, QueryParams, SponsoredTransactionActions } from "../types";

/** Wallet-like shape from dApp Kit (UiWallet or connection store). */
type ResolvableWallet = {
  features: unknown;
  name?: string;
  version?: string;
  [key: string]: unknown;
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when the connected wallet doesn't support EVE Frontier sponsored transactions.
 *
 * This occurs when the wallet doesn't implement the `evefrontier:sponsoredTransaction` feature.
 * Currently, only EVE Vault wallet supports this feature.
 *
 * @category Errors
 */
export class WalletSponsoredTransactionNotSupportedError extends Error {
  constructor(walletName?: string) {
    super(
      walletName
        ? `Wallet "${walletName}" does not support sponsored transactions`
        : "Connected wallet does not support sponsored transactions",
    );
    this.name = "WalletSponsoredTransactionNotSupportedError";
  }
}

/**
 * Error thrown when attempting a sponsored transaction without a connected wallet.
 *
 * @category Errors
 */
export class WalletNotConnectedError extends Error {
  constructor() {
    super("No wallet connected");
    this.name = "WalletNotConnectedError";
  }
}

/**
 * Error thrown when no account is selected in the connected wallet.
 *
 * @category Errors
 */
export class WalletNoAccountSelectedError extends Error {
  constructor() {
    super("No account selected in wallet");
    this.name = "WalletNoAccountSelectedError";
  }
}

/**
 * Error thrown when assembly ID cannot be resolved or is invalid.
 * Assembly ID must come from the assembly object (item_id) or the URL query param (itemId), and must be a valid non-negative integer.
 *
 * @category Errors
 */
export class AssemblyIdRequiredError extends Error {
  constructor(reason?: string) {
    super(
      reason ??
        "Assembly ID is required: pass an assembly object with item_id or set the itemId query param to a valid non-negative integer",
    );
    this.name = "AssemblyIdRequiredError";
  }
}

// ============================================================================
// Assembly ID resolution
// ============================================================================

/**
 * Resolves assembly ID to a non-negative integer from the assembly object or query param.
 * Fails fast with {@link AssemblyIdRequiredError} if neither source provides a valid id.
 */
function resolveAssemblyId(
  assemblyItemId: number | undefined,
  queryItemId: string | null,
): number {
  const fromAssembly =
    typeof assemblyItemId === "number" &&
    Number.isInteger(assemblyItemId) &&
    assemblyItemId >= 0
      ? assemblyItemId
      : undefined;

  if (fromAssembly !== undefined) {
    return fromAssembly;
  }

  if (queryItemId != null && queryItemId.trim() !== "") {
    const parsed = parseInt(queryItemId.trim(), 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new AssemblyIdRequiredError(
        `Query param itemId must be a non-negative integer; got "${queryItemId}"`,
      );
    }
    return parsed;
  }

  throw new AssemblyIdRequiredError();
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Error union type for {@link useSponsoredTransaction} mutation failures.
 *
 * @category Hooks - Sponsored Transaction
 */
export type UseSponsoredTransactionError =
  | WalletSponsoredTransactionNotSupportedError
  | WalletNotConnectedError
  | WalletNoAccountSelectedError
  | AssemblyIdRequiredError
  | Error;

/**
 * Arguments passed to {@link useSponsoredTransaction} mutate/mutateAsync.
 * With assembly object (id and type derived).
 *
 * @category Hooks - Sponsored Transaction
 */
export type UseSponsoredTransactionArgs = SponsoredTransactionArgs;

/**
 * React Query mutation options for {@link useSponsoredTransaction}.
 *
 * @category Hooks - Sponsored Transaction
 */
export type UseSponsoredTransactionMutationOptions = Omit<
  UseMutationOptions<
    SponsoredTransactionOutput,
    UseSponsoredTransactionError,
    UseSponsoredTransactionArgs
  >,
  "mutationFn"
>;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for executing gas-sponsored transactions via EVE Frontier.
 *
 * This mutation hook enables dApps to send transactions where gas fees are paid
 * by the EVE Frontier backend service, eliminating the need for users to have SUI
 * tokens for gas. The wallet must support the `evefrontier:sponsoredTransaction` feature
 * (currently only EVE Vault).
 *
 * The hook automatically uses the currently connected wallet and account (unless overridden)
 * and handles wallet feature detection and validation.
 *
 * **Input** (passed to `mutate` / `mutateAsync`):
 * - `txAction` (required) – The sponsored action to run (e.g. BRING_ONLINE, BRING_OFFLINE).
 * - `chain` (required) – Sui chain id, e.g. `"sui:testnet"` or `"sui:mainnet"`.
 * - `assembly` (required) – Full assembly object (`AssemblyType<Assemblies>`). Must include `type` and `item_id` (number). If `item_id` is missing or invalid, the hook falls back to the URL query param `itemId` (parsed as a non-negative integer). Fails with {@link AssemblyIdRequiredError} if neither source provides a valid id.
 * - `tenant` (optional) – Tenant ID. When omitted, the hook resolves it from the URL query param (e.g. `tenant`) with fallback to `"testevenet"`. Pass explicitly to override.
 * - `account` (optional) – Signer address. If omitted, the currently connected wallet account is used.
 *
 * **Output** (on success, in `data` or resolved from `mutateAsync`):
 * - `digest` (required) – Transaction digest.
 * - `effects` (optional) – Transaction effects, BCS encoded.
 * - `rawEffects` (optional) – Raw effects bytes.
 *
 * @category Hooks - Sponsored Transaction
 * @param options - React Query mutation options (optional)
 * @returns React Query mutation result with:
 *   - `mutate(args, options?)` - Trigger transaction (fire-and-forget)
 *   - `mutateAsync(args)` - Trigger transaction (returns Promise<SponsoredTransactionOutput>)
 *   - `isPending` - True while the transaction is in progress
 *   - `isError` - True if the last mutation failed
 *   - `error` - Error from the last failed mutation
 *   - `data` - Last successful result (`SponsoredTransactionOutput`)
 *
 * @throws {WalletNotConnectedError} If no wallet is connected
 * @throws {WalletNoAccountSelectedError} If no account is selected
 * @throws {WalletSponsoredTransactionNotSupportedError} If wallet doesn't support sponsored transactions
 * @throws {AssemblyIdRequiredError} If assembly ID is missing or invalid (neither assembly.item_id nor itemId query param is a valid non-negative integer)
 *
 * @example Basic bring online transaction
 * ```tsx
 * import { useSponsoredTransaction, SponsoredTransactionActions, useSmartObject } from "@evefrontier/dapp-kit";
 *
 * const BringOnlineButton = () => {
 *   const { assembly } = useSmartObject();
 *   const { mutateAsync: sendTx, isPending } = useSponsoredTransaction();
 *
 *   const handleBringOnline = async () => {
 *     if (!assembly) return;
 *     try {
 *       const result = await sendTx({
 *         txAction: SponsoredTransactionActions.BRING_ONLINE,
 *         assembly,
 *         chain: "sui:testnet",
 *       });
 *       console.log("Transaction digest:", result.digest);
 *     } catch (error) {
 *       console.error("Transaction failed:", error);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleBringOnline} disabled={isPending || !assembly}>
 *       {isPending ? "Processing..." : "Bring Online"}
 *     </button>
 *   );
 * };
 * ```
 *
 * @example With callbacks
 * ```tsx
 * const { assembly } = useSmartObject();
 * const { mutate: sendTx } = useSponsoredTransaction();
 *
 * sendTx(
 *   {
 *     txAction: SponsoredTransactionActions.BRING_ONLINE,
 *     assembly,
 *     chain: "sui:testnet",
 *   },
 *   {
 *     onSuccess: (result) => {
 *       notify({ type: Severity.Success, txHash: result.digest });
 *     },
 *     onError: (error) => {
 *       notify({ type: Severity.Error, message: error.message });
 *     },
 *   }
 * );
 * ```
 *
 * @example With assembly and optional account
 * ```tsx
 * const result = await sendTx({
 *   txAction: SponsoredTransactionActions.BRING_ONLINE,
 *   assembly, // full AssemblyType from useSmartObject() or similar
 *   chain: "sui:testnet",
 *   account: "0x...", // optional; defaults to connected wallet account
 * });
 * ```
 *
 * @see {@link SponsoredTransactionActions} for available transaction actions
 * @see {@link SponsoredTransactionInput} for full input type
 * @see {@link SponsoredTransactionOutput} for full output type
 */
export function useSponsoredTransaction({
  mutationKey,
  ...mutationOptions
}: UseSponsoredTransactionMutationOptions = {}): UseMutationResult<
  SponsoredTransactionOutput,
  UseSponsoredTransactionError,
  UseSponsoredTransactionArgs
> {
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const currentAccount = useCurrentAccount();

  const queryParams = new URLSearchParams(window.location.search);
  const queryItemId = queryParams.get(QueryParams.ITEM_ID);
  const queryTenant = queryParams.get(QueryParams.TENANT);

  return useMutation({
    mutationKey: [
      "evefrontier",
      "sponsored-transaction",
      ...(mutationKey ?? []),
    ],
    mutationFn: async (args): Promise<SponsoredTransactionOutput> => {
      // Resolve wallet at call time
      const connection =
        typeof dAppKit.stores?.$connection?.get === "function"
          ? (dAppKit.stores.$connection.get() as { wallet?: ResolvableWallet })
          : null;
      const walletFromStore = connection?.wallet;
      const wallet = walletFromStore ?? null;

      if (!wallet) {
        throw new WalletNotConnectedError();
      }

      const signerAccount = args.account ?? currentAccount?.address;
      if (!signerAccount) {
        throw new WalletNoAccountSelectedError();
      }

      if (!supportsSponsoredTransaction(wallet.features)) {
        throw new WalletSponsoredTransactionNotSupportedError(
          (wallet as ResolvableWallet).name,
        );
      }

      // Resolve method: prefer raw Wallet Standard wallets (object-shaped features), then store/current/list
      const walletName = (wallet as ResolvableWallet).name;
      const walletVersion = (wallet as ResolvableWallet).version;
      const rawWallets =
        typeof getWallets === "function" ? getWallets().get() : [];
      const rawWallet = rawWallets.find(
        (w) =>
          w.name === walletName &&
          (walletVersion == null || w.version === walletVersion),
      );
      let signSponsoredTransaction =
        (rawWallet != null
          ? getSponsoredTransactionMethod(
              rawWallet as Parameters<typeof getSponsoredTransactionMethod>[0],
            )
          : undefined) ??
        (walletFromStore != null
          ? getSponsoredTransactionMethod(
              walletFromStore as Parameters<
                typeof getSponsoredTransactionMethod
              >[0],
            )
          : undefined) ??
        getSponsoredTransactionMethod(
          wallet as Parameters<typeof getSponsoredTransactionMethod>[0],
        );
      if (!signSponsoredTransaction) {
        const walletFromList = wallets.find(
          (w) =>
            w.name === (wallet as ResolvableWallet).name &&
            ((wallet as ResolvableWallet).version == null ||
              w.version === (wallet as ResolvableWallet).version),
        );
        signSponsoredTransaction =
          walletFromList != null
            ? getSponsoredTransactionMethod(
                walletFromList as Parameters<
                  typeof getSponsoredTransactionMethod
                >[0],
              )
            : undefined;
      }
      if (!signSponsoredTransaction) {
        throw new WalletSponsoredTransactionNotSupportedError(
          (wallet as ResolvableWallet).name,
        );
      }

      const tenant = (args.tenant ?? queryTenant ?? "testevenet").trim();
      if (!tenant) {
        throw new Error(
          "Tenant could not be resolved; pass tenant or set the tenant query param",
        );
      }

      const assemblyId = resolveAssemblyId(args.assembly.item_id, queryItemId);

      // If the txAction is UPDATE_METADATA, it goes through the standard assembly type
      const assemblyType = getAssemblyTypeApiString(
        args.txAction === SponsoredTransactionActions.UPDATE_METADATA
          ? Assemblies.Assembly
          : args.assembly.type,
      );

      const payload: SponsoredTransactionInput = {
        txAction: args.txAction,
        assembly: assemblyId,
        assemblyType: assemblyType,
        metadata: args.metadata,
        tenant,
      };

      console.log("Sponsored Transaction Payload:", payload);

      return await signSponsoredTransaction(payload);
    },
    ...mutationOptions,
  });
}
