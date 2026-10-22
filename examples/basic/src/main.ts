import { quote } from './application/index.js';
import { MemoryPrices } from './adapters/index.js';

export const result = quote(new MemoryPrices(), { id: 'example' });
