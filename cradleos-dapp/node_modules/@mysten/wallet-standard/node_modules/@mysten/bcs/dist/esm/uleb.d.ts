export declare function ulebEncode(num: number | bigint): number[];
export declare function ulebDecode(arr: number[] | Uint8Array): {
    value: number;
    length: number;
};
