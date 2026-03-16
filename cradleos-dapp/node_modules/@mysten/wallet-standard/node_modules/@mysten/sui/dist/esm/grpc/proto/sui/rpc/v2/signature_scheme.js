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
export {
  SignatureScheme
};
//# sourceMappingURL=signature_scheme.js.map
