abstract class Base { abstract run(): number }
export class Derived extends Base { run(): number { return 2; } }
