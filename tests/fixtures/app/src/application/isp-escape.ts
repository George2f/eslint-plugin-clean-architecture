interface Storage { load(): number; save(value: number): void }
export function identity(storage: Storage): Storage { return storage; }
