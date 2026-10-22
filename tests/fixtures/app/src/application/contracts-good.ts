export interface Request { id: string; created: Date; tags: Map<string, string> }
export function load(input: Request): { id: string } { return { id: input.id }; }
