export interface sharedDataSchema {
  textureEnum: { [index: string]: number };
}
interface CoreOptions {
  alphaChannelOnCanvas: "opaque" | "premultiplied";
  powerPreference: "high-performance" | "low-power";
}
export default class Aurora {
  public static device: GPUDevice;
  public static context: GPUCanvasContext;
  public static canvas: HTMLCanvasElement;

  public static async initialize(
    canvas: HTMLCanvasElement,
    options?: CoreOptions
  ) {
    const context = canvas.getContext("webgpu")!;
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported on this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: options?.powerPreference ?? "low-power",
    });
    if (!adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }
    const device = await adapter.requestDevice();

    context.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: options?.alphaChannelOnCanvas ?? "opaque",
    });
    Aurora.canvas = canvas;
    Aurora.context = context;
    Aurora.device = device;
  }
}
