import type { Repository } from './ports.js';
export function load(port: Repository): number { return port.load(); }
