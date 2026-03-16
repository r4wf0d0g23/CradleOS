import { MessageType } from "@protobuf-ts/runtime";
import { JwkId } from "./jwk.js";
import { SignatureScheme } from "./signature_scheme.js";
import { Bcs } from "./bcs.js";
class UserSignature$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.UserSignature", [
      { no: 1, name: "bcs", kind: "message", T: () => Bcs },
      {
        no: 2,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", SignatureScheme]
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
class SimpleSignature$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.SimpleSignature", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", SignatureScheme]
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
class ZkLoginPublicIdentifier$Type extends MessageType {
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
class MultisigMemberPublicKey$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigMemberPublicKey", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", SignatureScheme]
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
class MultisigMember$Type extends MessageType {
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
class MultisigCommittee$Type extends MessageType {
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
class MultisigAggregatedSignature$Type extends MessageType {
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
class MultisigMemberSignature$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.MultisigMemberSignature", [
      {
        no: 1,
        name: "scheme",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.SignatureScheme", SignatureScheme]
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
class ZkLoginAuthenticator$Type extends MessageType {
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
      { no: 5, name: "jwk_id", kind: "message", T: () => JwkId }
    ]);
  }
}
const ZkLoginAuthenticator = new ZkLoginAuthenticator$Type();
class ZkLoginInputs$Type extends MessageType {
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
class ZkLoginProof$Type extends MessageType {
  constructor() {
    super("sui.rpc.v2.ZkLoginProof", [
      { no: 1, name: "a", kind: "message", T: () => CircomG1 },
      { no: 2, name: "b", kind: "message", T: () => CircomG2 },
      { no: 3, name: "c", kind: "message", T: () => CircomG1 }
    ]);
  }
}
const ZkLoginProof = new ZkLoginProof$Type();
class ZkLoginClaim$Type extends MessageType {
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
class CircomG1$Type extends MessageType {
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
class CircomG2$Type extends MessageType {
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
class PasskeyAuthenticator$Type extends MessageType {
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
class ValidatorCommittee$Type extends MessageType {
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
class ValidatorCommitteeMember$Type extends MessageType {
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
class ValidatorAggregatedSignature$Type extends MessageType {
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
export {
  CircomG1,
  CircomG2,
  MultisigAggregatedSignature,
  MultisigCommittee,
  MultisigMember,
  MultisigMemberPublicKey,
  MultisigMemberSignature,
  PasskeyAuthenticator,
  SimpleSignature,
  UserSignature,
  ValidatorAggregatedSignature,
  ValidatorCommittee,
  ValidatorCommitteeMember,
  ZkLoginAuthenticator,
  ZkLoginClaim,
  ZkLoginInputs,
  ZkLoginProof,
  ZkLoginPublicIdentifier
};
//# sourceMappingURL=signature.js.map
