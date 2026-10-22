import type { HttpRequest } from '../adapters/request.js';
export class Response {
  #request: HttpRequest | undefined;
  private constructor(request: HttpRequest) { this.#request = request; }
  get id(): string { return this.#request ? 'present' : 'absent'; }
}
