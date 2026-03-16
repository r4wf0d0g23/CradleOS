import { ClientCache } from "./cache.js";
class Experimental_BaseClient {
  constructor({
    network,
    base,
    cache = base?.cache ?? new ClientCache()
  }) {
    this.network = network;
    this.base = base ?? this;
    this.cache = cache;
  }
  $extend(...registrations) {
    return Object.create(
      this,
      Object.fromEntries(
        registrations.map((registration) => {
          return [registration.name, { value: registration.register(this) }];
        })
      )
    );
  }
}
export {
  Experimental_BaseClient
};
//# sourceMappingURL=client.js.map
