interface Writable { save(): void }
export class ReadOnly implements Writable { save(): void { throw new Error('Unsupported'); } }
