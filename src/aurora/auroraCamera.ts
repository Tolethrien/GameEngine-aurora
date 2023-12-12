import Mat4 from "../math/mat4";
import Aurora from "./auroraCore";

export const cameraData = {
  keyPressed: new Set(),
};

export default class AuroraCamera {
  view: Mat4;
  projectionViewMatrix: Mat4;
  x: number;
  y: number;
  speed: number;
  zoom: number;
  maxZoom: number;
  minZoom: number;
  constructor() {
    this.projectionViewMatrix = Mat4.create();
    this.view = Mat4.create().lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
    this.x = Aurora.canvas.width / 2;
    this.y = Aurora.canvas.height / 2;
    this.speed = 15;
    this.zoom = 1;
    this.maxZoom = 10;
    this.minZoom = 0.1;

    window.onkeydown = (event: KeyboardEvent) => {
      const pressedKey = event.key === " " ? "space" : event.key;
      !event.repeat && cameraData.keyPressed.add(pressedKey);
    };
    window.onkeyup = (event: KeyboardEvent) => {
      const pressedKey = event.key === " " ? "space" : event.key;
      cameraData.keyPressed.has(pressedKey) &&
        cameraData.keyPressed.delete(pressedKey);
    };

    //===========================================
  }
  update() {
    if (cameraData.keyPressed.has("d")) this.x += this.speed;
    else if (cameraData.keyPressed.has("a")) this.x -= this.speed;
    if (cameraData.keyPressed.has("w")) this.y -= this.speed;
    else if (cameraData.keyPressed.has("s")) this.y += this.speed;
    if (cameraData.keyPressed.has("ArrowDown"))
      this.zoom > this.minZoom && (this.zoom -= 0.01 * Math.log(this.zoom + 1));
    else if (cameraData.keyPressed.has("ArrowUp"))
      this.zoom < this.maxZoom && (this.zoom += 0.01 * Math.log(this.zoom + 1));

    this.projectionViewMatrix = Mat4.create()
      .ortho(
        this.x * this.zoom - Aurora.canvas.width / 2,
        this.x * this.zoom + Aurora.canvas.width / 2,
        this.y * this.zoom + Aurora.canvas.height / 2,
        this.y * this.zoom - Aurora.canvas.height / 2,
        -1,
        1
      )
      .multiply(this.view)
      .scale(this.zoom);
  }
}
