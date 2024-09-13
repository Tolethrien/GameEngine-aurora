import Vec2D from "../math/vec2D";
import Vec4D from "../math/vec4D";
declare global {
  type RGB = [number, number, number];
  type RGBA = [number, number, number, number];
  interface Vec2DType extends Vec2D {}
  interface Vec4DType extends Vec4D {}
  type Position2D = { x: number; y: number };
  type Size2D = { width: number; height: number };
}
