export class OwnershipRouter {
  constructor(primary, fallback, { logger = console } = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.logger = logger;
    this.stats = { grpcHits: 0, grpcFallbacks: 0, cacheHits: 0 };
  }

  async handle(method, params) {
    try {
      const result = await this.primary.handle(method, params);
      this.stats.grpcHits++;
      return result;
    } catch (error) {
      this.stats.grpcFallbacks++;
      this.logger.warn(`[ownership-grpc] ${method} unavailable: ${error.message}; using recovery cache`);
      const result = await this.fallback.handle(method, params);
      this.stats.cacheHits++;
      return result;
    }
  }
}
