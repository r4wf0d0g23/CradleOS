"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var signature_scheme_exports = {};
__export(signature_scheme_exports, {
  SignatureScheme: () => SignatureScheme
});
module.exports = __toCommonJS(signature_scheme_exports);
var SignatureScheme = /* @__PURE__ */ ((SignatureScheme2) => {
  SignatureScheme2[SignatureScheme2["ED25519"] = 0] = "ED25519";
  SignatureScheme2[SignatureScheme2["SECP256K1"] = 1] = "SECP256K1";
  SignatureScheme2[SignatureScheme2["SECP256R1"] = 2] = "SECP256R1";
  SignatureScheme2[SignatureScheme2["MULTISIG"] = 3] = "MULTISIG";
  SignatureScheme2[SignatureScheme2["BLS12381"] = 4] = "BLS12381";
  SignatureScheme2[SignatureScheme2["ZKLOGIN"] = 5] = "ZKLOGIN";
  SignatureScheme2[SignatureScheme2["PASSKEY"] = 6] = "PASSKEY";
  return SignatureScheme2;
})(SignatureScheme || {});
//# sourceMappingURL=signature_scheme.js.map
