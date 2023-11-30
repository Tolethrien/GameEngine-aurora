import html from "./renderFrame.html?raw";
import "./renderFrame.css";
import { clamp, mapRange } from "../../math/math";

const REFRESH_RATE = 1;
const SAVED_FRAMES = 60;
const BAR_WIDTH = 1.6;
const MAX_BAR_HEIGHT = 15;
const BAR_GAP = 0.1;
export default class RenderFrame {
  private static body: HTMLBodyElement =
    document.getElementsByTagName("body")[0];
  private static frameTimes: number[][] = [[0, 0]];
  private static currFrame = 0;
  private static cpuTime = 0;
  private static gpuTime = 0;
  private static quadCount = 0;
  private static MAXquadCount = 0;
  private static startTime = 0;
  private static lastFrameTime = 0;
  private static lastStartTime = 0;
  private static swapTime = 0;
  private static statsRefresh = REFRESH_RATE * 60;
  private static frame: HTMLDivElement;
  private static statsList: HTMLCollectionOf<HTMLParagraphElement>;
  private static frameCounter: HTMLParagraphElement;
  private static canvas: HTMLCanvasElement;
  private static ctx: CanvasRenderingContext2D;

  public static Initialize() {
    RenderFrame.createFrame();
    RenderFrame.dragFrame();
    RenderFrame.closeFrame();
  }
  private static createFrame() {
    const element = document.createElement("template");
    element.innerHTML = html;
    const frame = element.content.cloneNode(true);
    this.body.prepend(frame);
    this.frame = document.getElementsByClassName("framer")[0] as HTMLDivElement;
    this.statsList = document.getElementsByClassName("framer_stats")[0]
      .children as HTMLCollectionOf<HTMLParagraphElement>;
    this.frameCounter = document.getElementsByClassName(
      "framer_fps_counter"
    )[0] as HTMLParagraphElement;
    this.canvas = document.getElementsByClassName(
      "framer_fps_visual"
    )[0] as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
  }

  private static dragFrame() {
    const dragElement = document.getElementsByClassName(
      "framer_title_drag"
    )[0] as HTMLElement;

    let mouseDown = false;
    let offset = { x: 0, y: 0 };
    dragElement.addEventListener("mousedown", (e) => {
      mouseDown = true;
      offset = {
        x: this.frame.offsetLeft - e.clientX,
        y: this.frame.offsetTop - e.clientY,
      };
    });
    dragElement.addEventListener("mouseup", () => {
      mouseDown = false;
    });
    this.frame.addEventListener("mousemove", (e) => {
      if (mouseDown) {
        this.frame.style.left = e.clientX + offset.x + "px";
        this.frame.style.top = e.clientY + offset.y + "px";
      }
    });
  }
  private static closeFrame() {
    const closeElement = document.getElementsByClassName(
      "framer_title_close"
    )[0] as HTMLElement;
    closeElement.addEventListener("click", () =>
      this.body.removeChild(this.frame)
    );
  }

  public static start() {
    this.startTime = performance.now();
    this.lastFrameTime = (this.startTime - this.lastStartTime) / 1000;
    this.lastStartTime = this.startTime;
  }
  public static swapToGPU() {
    this.swapTime = performance.now();
  }
  public static stop() {
    const stopTime = performance.now();
    this.calculateFrames();
    this.calculateTimes(stopTime);
    this.updateGameData();
    this.updateCanvas();
    if (this.currFrame % this.statsRefresh === 0 && this.currFrame !== 0) {
      this.updateFrame();
      this.currFrame = 0;
    } else this.currFrame++;
  }
  public static setQuadCount(quads: number, max: number) {
    this.quadCount = quads;
    this.MAXquadCount = max;
  }
  private static calculateFrames() {
    if (this.frameTimes.length === SAVED_FRAMES) this.frameTimes.shift();
    this.frameTimes.push([
      Math.floor(1000 / this.lastFrameTime / 100),
      performance.now() - this.startTime,
    ]);
  }
  private static calculateTimes(stopTime: number) {
    this.cpuTime = this.swapTime - this.startTime;
    this.gpuTime = stopTime - this.swapTime;
  }
  private static updateGameData() {
    this.statsList[3].innerText = `QuadCount: ${this.quadCount}`;
    this.statsList[4].innerText = `QuadsLimit: ${this.MAXquadCount}`;
  }
  private static updateFrame() {
    const fps = String(
      this.frameTimes.reduce((acc, frame) => acc + frame[0], 0) / SAVED_FRAMES
    );
    this.frameCounter.innerText = `FPS: ${fps[0]}${fps[1]},${fps[2]}`;
    this.statsList[0].innerText = `FrameTime: ${this.frameTimes
      .at(-1)?.[1]
      .toFixed(2)}MS`;
    this.statsList[1].innerText = `CPU time: ${this.cpuTime.toFixed(2)}ms`;
    this.statsList[2].innerText = `GPU time: ${this.gpuTime.toFixed(2)}ms`;
    this.statsList[5].innerText = `Stats Refresh rate: ${REFRESH_RATE}s`;
  }
  private static updateCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.frameTimes.forEach((frame, index) => {
      const value = mapRange(
        clamp(frame[0], 0, 600),
        0,
        600,
        0,
        MAX_BAR_HEIGHT
      );
      const color = this.colorLerp(value, MAX_BAR_HEIGHT);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(
        this.canvas.width - BAR_WIDTH - index * (BAR_WIDTH + BAR_GAP),
        this.canvas.height,
        BAR_WIDTH,
        -value
      );
    });
  }
  private static colorLerp(value: number, maxValue: number) {
    const normalizedValue = Math.min(Math.max(value / maxValue, 0), 1);
    const r = Math.floor(255 * (1 - normalizedValue));
    const g = Math.floor(255 * normalizedValue);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
}
