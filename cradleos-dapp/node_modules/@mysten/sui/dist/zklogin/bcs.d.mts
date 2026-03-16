import * as _mysten_bcs810 from "@mysten/bcs";
import { InferBcsInput } from "@mysten/bcs";

//#region src/zklogin/bcs.d.ts
declare const zkLoginSignature: _mysten_bcs810.BcsStruct<{
  inputs: _mysten_bcs810.BcsStruct<{
    proofPoints: _mysten_bcs810.BcsStruct<{
      a: _mysten_bcs810.BcsType<string[], Iterable<string> & {
        length: number;
      }, string>;
      b: _mysten_bcs810.BcsType<string[][], Iterable<Iterable<string> & {
        length: number;
      }> & {
        length: number;
      }, string>;
      c: _mysten_bcs810.BcsType<string[], Iterable<string> & {
        length: number;
      }, string>;
    }, string>;
    issBase64Details: _mysten_bcs810.BcsStruct<{
      value: _mysten_bcs810.BcsType<string, string, "string">;
      indexMod4: _mysten_bcs810.BcsType<number, number, "u8">;
    }, string>;
    headerBase64: _mysten_bcs810.BcsType<string, string, "string">;
    addressSeed: _mysten_bcs810.BcsType<string, string, "string">;
  }, string>;
  maxEpoch: _mysten_bcs810.BcsType<string, string | number | bigint, "u64">;
  userSignature: _mysten_bcs810.BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
}, string>;
type ZkLoginSignature = InferBcsInput<typeof zkLoginSignature>;
type ZkLoginSignatureInputs = ZkLoginSignature['inputs'];
//#endregion
export { ZkLoginSignature, ZkLoginSignatureInputs };
//# sourceMappingURL=bcs.d.mts.map