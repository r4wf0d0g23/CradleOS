import { TypeTagSerializer } from "../bcs/type-tag-serializer.js";
import { deriveDynamicFieldID } from "../utils/dynamic-fields.js";
import { normalizeStructTag, parseStructTag, SUI_ADDRESS_LENGTH } from "../utils/sui-types.js";
import { Experimental_BaseClient } from "./client.js";
import { MvrClient } from "./mvr.js";
const DEFAULT_MVR_URLS = {
  mainnet: "https://mainnet.mvr.mystenlabs.com",
  testnet: "https://testnet.mvr.mystenlabs.com"
};
class Experimental_CoreClient extends Experimental_BaseClient {
  constructor(options) {
    super(options);
    this.core = this;
    this.mvr = new MvrClient({
      cache: this.cache.scope("core.mvr"),
      url: options.mvr?.url ?? DEFAULT_MVR_URLS[this.network],
      pageSize: options.mvr?.pageSize,
      overrides: options.mvr?.overrides
    });
  }
  async getObject(options) {
    const { objectId } = options;
    const {
      objects: [result]
    } = await this.getObjects({ objectIds: [objectId], signal: options.signal });
    if (result instanceof Error) {
      throw result;
    }
    return { object: result };
  }
  async getDynamicField(options) {
    const normalizedNameType = TypeTagSerializer.parseFromStr(
      (await this.core.mvr.resolveType({
        type: options.name.type
      })).type
    );
    const fieldId = deriveDynamicFieldID(options.parentId, normalizedNameType, options.name.bcs);
    const {
      objects: [fieldObject]
    } = await this.getObjects({
      objectIds: [fieldId],
      signal: options.signal
    });
    if (fieldObject instanceof Error) {
      throw fieldObject;
    }
    const fieldType = parseStructTag(fieldObject.type);
    const content = await fieldObject.content;
    return {
      dynamicField: {
        id: fieldObject.id,
        digest: fieldObject.digest,
        version: fieldObject.version,
        type: fieldObject.type,
        previousTransaction: fieldObject.previousTransaction,
        name: {
          type: typeof fieldType.typeParams[0] === "string" ? fieldType.typeParams[0] : normalizeStructTag(fieldType.typeParams[0]),
          bcs: options.name.bcs
        },
        value: {
          type: typeof fieldType.typeParams[1] === "string" ? fieldType.typeParams[1] : normalizeStructTag(fieldType.typeParams[1]),
          bcs: content.slice(SUI_ADDRESS_LENGTH + options.name.bcs.length)
        }
      }
    };
  }
  async waitForTransaction({
    signal,
    timeout = 60 * 1e3,
    ...input
  }) {
    const abortSignal = signal ? AbortSignal.any([AbortSignal.timeout(timeout), signal]) : AbortSignal.timeout(timeout);
    const abortPromise = new Promise((_, reject) => {
      abortSignal.addEventListener("abort", () => reject(abortSignal.reason));
    });
    abortPromise.catch(() => {
    });
    while (true) {
      abortSignal.throwIfAborted();
      try {
        return await this.getTransaction({
          ...input,
          signal: abortSignal
        });
      } catch {
        await Promise.race([new Promise((resolve) => setTimeout(resolve, 2e3)), abortPromise]);
      }
    }
  }
}
export {
  Experimental_CoreClient
};
//# sourceMappingURL=core.js.map
