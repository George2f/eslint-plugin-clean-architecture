import { withTax, type PriceRepository } from '../domain/index.js';
import type { QuoteRequest, QuoteResponse } from './models.js';

export function quote(repository: PriceRepository, request: QuoteRequest): QuoteResponse {
  return { amount: withTax(repository.price(request.id)) };
}
