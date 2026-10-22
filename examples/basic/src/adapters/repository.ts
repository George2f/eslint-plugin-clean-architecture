import type { PriceRepository } from '../domain/index.js';

export class MemoryPrices implements PriceRepository {
  price(): number { return 100; }
}
