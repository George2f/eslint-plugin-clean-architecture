import type { OuterPort } from '../adapters/outer-port.js';
export function load(port: OuterPort): number { return port.load(); }
