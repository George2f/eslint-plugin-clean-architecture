interface Reader { load(): number }
export function load(storage: Reader): number { return storage.load(); }
