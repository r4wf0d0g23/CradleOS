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
var signature_exports = {};
__export(signature_exports, {
  CircomG1: () => CircomG1,
  CircomG2: () => CircomG2,
  MultisigAggregatedSignature: () => MultisigAggregatedSignature,
  MultisigCommittee: () => MultisigCommittee,
  MultisigMember: () => MultisigMember,
  MultisigMemberPublicKey: () => MultisigMemberPublicKey,
  MultisigMemberSignature: () => MultisigMemberSignature,
  PasskeyAuthenticator: () => PasskeyAuthenticator,
  SimpleSignature: () => SimpleSignature,
  UserSignature: () => UserSignature,
  ValidatorAggregatedSignature: () => ValidatorAggregatedSignature,
  ValidatorCommittee: () => ValidatorCommittee,
  ValidatorCommitteeMember: () => ValidatorCommitteeMember,
  ZkLoginAuthenticator: () => ZkLoginAuthenticator,
  ZkLoginClaim: () => ZkLoginClaim,
  ZkLoginInputs: () => ZkLoginInputs,
  ZkLoginProof: () => ZkLoginProof,
  ZkLoginPublicIdentifier: () => ZkLoginPublicIdentifier
});
module.exports = __toCommonJS(signature_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_jwk = require("./jwk.js");
var import_signature_scheme = require("./signature_scheme.js");
var import_bcs = require("./bcs.js");
class UserSignature$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.UserSignature", [
      { no: 1, name: "bcs", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 2,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", import_signature_scheme.SignatureScheme]
      },
      { no: 3, name: "simple", kind: "message", oneof: "signature", T: () => SimpleSignature },
      {
        no: 4,
        name: "multisig",
        kind: "message",
        oneof: "signature",
        T: () => MultisigAggregatedSignature
      },
      {
        no: 5,
        name: "zklogin",
        kind: "message",
        oneof: "signature",
        T: () => ZkLoginAuthenticator
      },
      {
        no: 6,
        name: "passkey",
        kind: "message",
        oneof: "signature",
        T: () => PasskeyAuthenticator
      }
    ]);
  }
}
const UserSignature = new UserSignature$Type();
class SimpleSignature$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SimpleSignature", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", import_signature_scheme.SignatureScheme]
      },
      {
        no: 2,
        name: "signature",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 3,
        name: "public_key",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const SimpleSignature = new SimpleSignature$Type();
class ZkLoginPublicIdentifier$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginPublicIdentifier", [
      {
        no: 1,
        name: "iss",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "address_seed",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ZkLoginPublicIdentifier = new ZkLoginPublicIdentifier$Type();
class MultisigMemberPublicKey$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigMemberPublicKey", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", import_signature_scheme.SignatureScheme]
      },
      {
        no: 2,
        name: "public_key",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 3, name: "zklogin", kind: "message", T: () => ZkLoginPublicIdentifier }
    ]);
  }
}
const MultisigMemberPublicKey = new MultisigMemberPublicKey$Type();
class MultisigMember$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigMember", [
      { no: 1, name: "public_key", kind: "message", T: () => MultisigMemberPublicKey },
      {
        no: 2,
        name: "weight",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const MultisigMember = new MultisigMember$Type();
class MultisigCommittee$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigCommittee", [
      {
        no: 1,
        name: "members",
        kind: "message",
        repeat: 1,
        T: () => MultisigMember
      },
      {
        no: 2,
        name: "threshold",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const MultisigCommittee = new MultisigCommittee$Type();
class MultisigAggregatedSignature$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigAggregatedSignature", [
      {
        no: 1,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => MultisigMemberSignature
      },
      {
        no: 2,
        name: "bitmap",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "legacy_bitmap",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 4, name: "committee", kind: "message", T: () => MultisigCommittee }
    ]);
  }
}
const MultisigAggregatedSignature = new MultisigAggregatedSignature$Type();
class MultisigMemberSignature$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigMemberSignature", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", import_signature_scheme.SignatureScheme]
      },
      {
        no: 2,
        name: "signature",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      { no: 3, name: "zklogin", kind: "message", T: () => ZkLoginAuthenticator },
      { no: 4, name: "passkey", kind: "message", T: () => PasskeyAuthenticator }
    ]);
  }
}
const MultisigMemberSignature = new MultisigMemberSignature$Type();
class ZkLoginAuthenticator$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginAuthenticator", [
      { no: 1, name: "inputs", kind: "message", T: () => ZkLoginInputs },
      {
        no: 2,
        name: "max_epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 3, name: "signature", kind: "message", T: () => SimpleSignature },
      { no: 4, name: "public_identifier", kind: "message", T: () => ZkLoginPublicIdentifier },
      { no: 5, name: "jwk_id", kind: "message", T: () => import_jwk.JwkId }
    ]);
  }
}
const ZkLoginAuthenticator = new ZkLoginAuthenticator$Type();
class ZkLoginInputs$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginInputs", [
      { no: 1, name: "proof_points", kind: "message", T: () => ZkLoginProof },
      { no: 2, name: "iss_base64_details", kind: "message", T: () => ZkLoginClaim },
      {
        no: 3,
        name: "header_base64",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "address_seed",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ZkLoginInputs = new ZkLoginInputs$Type();
class ZkLoginProof$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginProof", [
      { no: 1, name: "a", kind: "message", T: () => CircomG1 },
      { no: 2, name: "b", kind: "message", T: () => CircomG2 },
      { no: 3, name: "c", kind: "message", T: () => CircomG1 }
    ]);
  }
}
const ZkLoginProof = new ZkLoginProof$Type();
class ZkLoginClaim$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginClaim", [
      {
        no: 1,
        name: "value",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "index_mod_4",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const ZkLoginClaim = new ZkLoginClaim$Type();
class CircomG1$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CircomG1", [
      {
        no: 1,
        name: "e0",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "e1",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "e2",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const CircomG1 = new CircomG1$Type();
class CircomG2$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CircomG2", [
      {
        no: 1,
        name: "e00",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "e01",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "e10",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "e11",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 5,
        name: "e20",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "e21",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const CircomG2 = new CircomG2$Type();
class PasskeyAuthenticator$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.PasskeyAuthenticator", [
      {
        no: 1,
        name: "authenticator_data",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 2,
        name: "client_data_json",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "signature", kind: "message", T: () => SimpleSignature }
    ]);
  }
}
const PasskeyAuthenticator = new PasskeyAuthenticator$Type();
class ValidatorCommittee$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ValidatorCommittee", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "members",
        kind: "message",
        repeat: 1,
        T: () => ValidatorCommitteeMember
      }
    ]);
  }
}
const ValidatorCommittee = new ValidatorCommittee$Type();
class ValidatorCommitteeMember$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ValidatorCommitteeMember", [
      {
        no: 1,
        name: "public_key",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 2,
        name: "weight",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const ValidatorCommitteeMember = new ValidatorCommitteeMember$Type();
class ValidatorAggregatedSignature$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ValidatorAggregatedSignature", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "signature",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 3,
        name: "bitmap",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      }
    ]);
  }
}
const ValidatorAggregatedSignature = new ValidatorAggregatedSignature$Type();
//# sourceMappingURL=signature.js.map
