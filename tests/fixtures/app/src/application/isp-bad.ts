interface Storage { load(): number; save(value: number): void }
export function load(storage: Storage): number { return storage.load(); }
