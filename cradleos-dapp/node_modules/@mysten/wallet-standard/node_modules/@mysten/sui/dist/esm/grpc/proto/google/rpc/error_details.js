import { MessageType } from "@protobuf-ts/runtime";
import { Duration } from "../protobuf/duration.js";
class ErrorInfo$Type extends MessageType {
  constructor() {
    super("google.rpc.ErrorInfo", [
      {
        no: 1,
        name: "reason",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "domain",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "metadata",
        kind: "map",
        K: 9,
        V: {
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      }
    ]);
  }
}
const ErrorInfo = new ErrorInfo$Type();
class RetryInfo$Type extends MessageType {
  constructor() {
    super("google.rpc.RetryInfo", [
      { no: 1, name: "retry_delay", kind: "message", T: () => Duration }
    ]);
  }
}
const RetryInfo = new RetryInfo$Type();
class DebugInfo$Type extends MessageType {
  constructor() {
    super("google.rpc.DebugInfo", [
      {
        no: 1,
        name: "stack_entries",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 2,
        name: "detail",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const DebugInfo = new DebugInfo$Type();
class QuotaFailure$Type extends MessageType {
  constructor() {
    super("google.rpc.QuotaFailure", [
      {
        no: 1,
        name: "violations",
        kind: "message",
        repeat: 1,
        T: () => QuotaFailure_Violation
      }
    ]);
  }
}
const QuotaFailure = new QuotaFailure$Type();
class QuotaFailure_Violation$Type extends MessageType {
  constructor() {
    super("google.rpc.QuotaFailure.Violation", [
      {
        no: 1,
        name: "subject",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "description",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const QuotaFailure_Violation = new QuotaFailure_Violation$Type();
class PreconditionFailure$Type extends MessageType {
  constructor() {
    super("google.rpc.PreconditionFailure", [
      {
        no: 1,
        name: "violations",
        kind: "message",
        repeat: 1,
        T: () => PreconditionFailure_Violation
      }
    ]);
  }
}
const PreconditionFailure = new PreconditionFailure$Type();
class PreconditionFailure_Violation$Type extends MessageType {
  constructor() {
    super("google.rpc.PreconditionFailure.Violation", [
      {
        no: 1,
        name: "type",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "subject",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "description",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const PreconditionFailure_Violation = new PreconditionFailure_Violation$Type();
class BadRequest$Type extends MessageType {
  constructor() {
    super("google.rpc.BadRequest", [
      {
        no: 1,
        name: "field_violations",
        kind: "message",
        repeat: 1,
        T: () => BadRequest_FieldViolation
      }
    ]);
  }
}
const BadRequest = new BadRequest$Type();
class BadRequest_FieldViolation$Type extends MessageType {
  constructor() {
    super("google.rpc.BadRequest.FieldViolation", [
      {
        no: 1,
        name: "field",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "description",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "reason",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "localized_message", kind: "message", T: () => LocalizedMessage }
    ]);
  }
}
const BadRequest_FieldViolation = new BadRequest_FieldViolation$Type();
class RequestInfo$Type extends MessageType {
  constructor() {
    super("google.rpc.RequestInfo", [
      {
        no: 1,
        name: "request_id",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "serving_data",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const RequestInfo = new RequestInfo$Type();
class ResourceInfo$Type extends MessageType {
  constructor() {
    super("google.rpc.ResourceInfo", [
      {
        no: 1,
        name: "resource_type",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "resource_name",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "owner",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "description",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ResourceInfo = new ResourceInfo$Type();
class Help$Type extends MessageType {
  constructor() {
    super("google.rpc.Help", [
      {
        no: 1,
        name: "links",
        kind: "message",
        repeat: 1,
        T: () => Help_Link
      }
    ]);
  }
}
const Help = new Help$Type();
class Help_Link$Type extends MessageType {
  constructor() {
    super("google.rpc.Help.Link", [
      {
        no: 1,
        name: "description",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "url",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const Help_Link = new Help_Link$Type();
class LocalizedMessage$Type extends MessageType {
  constructor() {
    super("google.rpc.LocalizedMessage", [
      {
        no: 1,
        name: "locale",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "message",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const LocalizedMessage = new LocalizedMessage$Type();
export {
  BadRequest,
  BadRequest_FieldViolation,
  DebugInfo,
  ErrorInfo,
  Help,
  Help_Link,
  LocalizedMessage,
  PreconditionFailure,
  PreconditionFailure_Violation,
  QuotaFailure,
  QuotaFailure_Violation,
  RequestInfo,
  ResourceInfo,
  RetryInfo
};
//# sourceMappingURL=error_details.js.map
