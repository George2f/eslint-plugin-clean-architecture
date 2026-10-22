import type { Order } from '../domain/entity.js';
export type Response = { orders: Promise<Order[]> };
