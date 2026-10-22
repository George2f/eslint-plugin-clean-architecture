class Shape { id = 1; }
class Circle extends Shape { radius = 1; }
class Square extends Shape { width = 1; }
export function area(shape: Shape): number {
  if (shape instanceof Circle) return shape.radius ** 2;
  if (shape instanceof Square) return shape.width ** 2;
  return 0;
}
