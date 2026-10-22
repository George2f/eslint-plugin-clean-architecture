export interface HttpRequest { headers: Record<string, string> }
export function request(): HttpRequest { return { headers: {} }; }
