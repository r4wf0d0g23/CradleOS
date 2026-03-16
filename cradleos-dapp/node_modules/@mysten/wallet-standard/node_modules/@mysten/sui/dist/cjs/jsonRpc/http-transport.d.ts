import type { WebsocketClientOptions } from './rpc-websocket-client.js';
/**
 * An object defining headers to be passed to the RPC server
 */
export type HttpHeaders = {
    [header: string]: string;
};
export interface JsonRpcHTTPTransportOptions {
    fetch?: typeof fetch;
    WebSocketConstructor?: typeof WebSocket;
    url: string;
    rpc?: {
        headers?: HttpHeaders;
        url?: string;
    };
    websocket?: WebsocketClientOptions & {
        url?: string;
    };
}
export interface JsonRpcTransportRequestOptions {
    method: string;
    params: unknown[];
    signal?: AbortSignal;
}
export interface JsonRpcTransportSubscribeOptions<T> {
    method: string;
    unsubscribe: string;
    params: unknown[];
    onMessage: (event: T) => void;
    signal?: AbortSignal;
}
export interface JsonRpcTransport {
    request<T = unknown>(input: JsonRpcTransportRequestOptions): Promise<T>;
    subscribe<T = unknown>(input: JsonRpcTransportSubscribeOptions<T>): Promise<() => Promise<boolean>>;
}
export declare class JsonRpcHTTPTransport implements JsonRpcTransport {
    #private;
    constructor(options: JsonRpcHTTPTransportOptions);
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
    request<T>(input: JsonRpcTransportRequestOptions): Promise<T>;
    subscribe<T>(input: JsonRpcTransportSubscribeOptions<T>): Promise<() => Promise<boolean>>;
}
