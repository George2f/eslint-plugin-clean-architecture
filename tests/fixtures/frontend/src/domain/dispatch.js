class Shape {}
class Circle extends Shape {}
class Square extends Shape {}

export function area(shape) {
  if (shape instanceof Circle) return 1;
  if (shape instanceof Square) return 2;
  return 0;
}
