import { bcs } from "../bcs/index.js";
function messageWithIntent(scope, message) {
  return bcs.IntentMessage(bcs.bytes(message.length)).serialize({
    intent: {
      scope: { [scope]: true },
      version: { V0: true },
      appId: { Sui: true }
    },
    value: message
  }).toBytes();
}
export {
  messageWithIntent
};
//# sourceMappingURL=intent.js.map
