class Base {
  save() {
    return true;
  }
}

export class ReadOnly extends Base {
  save() {
    throw new Error('not supported');
  }
}
