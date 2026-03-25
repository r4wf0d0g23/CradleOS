/**
 * Sui client factory — gRPC (primary) + GraphQL (secondary).
 *
 * gRPC is faster protobuf transport; same API as SuiClient.
 * GraphQL for complex nested queries where JSON-RPC would need multiple calls.
 */
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { SUI_TESTNET_RPC, SUI_GRAPHQL } from "./constants";

/** Primary client — fast reads/writes via gRPC-Web (same fullnode URL) */
export const grpcClient = new SuiGrpcClient({
  network: "testnet",
  baseUrl: SUI_TESTNET_RPC,
});

/** Secondary client — complex queries via GraphQL */
export const graphqlClient = new SuiGraphQLClient({
  network: "testnet",
  url: SUI_GRAPHQL,
});

/** Default export is gRPC */
export default grpcClient;
