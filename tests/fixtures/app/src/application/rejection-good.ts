interface Writable { save(): void }
export class Storage implements Writable { save(): void {} }
export class Unrelated { fail(): never { throw new Error('Failure'); } }
