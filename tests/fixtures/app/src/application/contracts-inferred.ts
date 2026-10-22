import { request } from '../adapters/request.js';
export const getRequest = () => ({ payload: [request()] });
