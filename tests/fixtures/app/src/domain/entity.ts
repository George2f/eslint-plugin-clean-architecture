export class Order {
  constructor(public total: number) {}
  approve(): boolean { return this.total > 0; }
}
