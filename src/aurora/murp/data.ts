import AuroraBuffer from "../auroraBuffer";
import AuroraCamera from "../auroraCamera";
type ScreenEffects = keyof typeof SCREEN_EFFECTS;

export interface GlyphSchema {
  width: number;
  height: number;
  x: number;
  y: number;
  xadvance: number;
  yoffset: number;
  xoffset: number;
  id: number;
}

interface TextProps {
  position: { x: number; y: number };
  weight: number;
  textureToUse: number;
  color: Uint8ClampedArray;
  alpha: number;
  bloom: number;
  text: string;
}
interface LightProps {
  type: LightType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  tint: [number, number, number];
  intensity: number;
}
export interface BatcherOptions {
  backgroundColor: [number, number, number, number];
  maxQuadPerSceen: number;
  maxLightsPerSceen: number;
  customCamera: boolean;
  bloom: boolean;
  bloomStrength: number;
  lights: boolean;
}
export interface Stride {
  VERTICES: number;
  ADDDATA: number;
  INDICIES: number;
  LIGHTS: number;
}
export default class BatcherData {
  public static warnings: {
    textureWarning: string;
  };
  public static stride: Stride;
  public static batcherOptions: BatcherOptions;
  public static numberOfQuadsInBatch: number;
  public static numberOfLightsInFrame: number;
  public static numberOfGuiInFrame: number;
  public static numberOfQuadsInBuffer: number;
  public static vertexGUIBuffer: GPUBuffer;
  public static addDataGUIBuffer: GPUBuffer;
  public static projectionBuffer: GPUBuffer;
  public static indexBuffer: GPUBuffer;
  public static testMode: boolean;
  public static customcameraMatrix: Float32Array;
  public static camera: AuroraCamera | undefined;
  public static pipelinesInFrame: GPUCommandBuffer[] = [];
  public static universalSampler: GPUSampler;
  public static linearSampler: GPUSampler;
  public static fontData: Record<number, Omit<GlyphSchema, "id">>;
  public static colorCorrection: [number, number, number];
  public static GPUCalls: { render: number; compute: number };
  public static renderGui: boolean;
  public static initialize() {
    //limits
    //warnings
    this.warnings = {
      textureWarning:
        "AuroraBatcher Error: Batcher required 'textureStore' to by set to true(default) in 'Aurora.initialize()' options and initial textureArray named 'userTextureAtlas' to work.\nMake sure that you are crating this textureArray before calling 'AuroraBatcher.createBatcher()'. \n\nTIP: if you dont have textures yet you can create emptyTextureArray as a placeholder, just remember to set you drawQuad with 'isTexture:0'.",
    };
    this.batcherOptions = {
      backgroundColor: [0, 0, 0, 255],
      maxQuadPerSceen: 1000,
      maxLightsPerSceen: 100,
      customCamera: false,
      bloom: true,
      bloomStrength: 16,
      lights: true,
    };
    //data
    this.avalibleScreenEffects = {
      none: 0,
      grayscale: 1,
      sepia: 2,
      invert: 3,
      chromaticAbber: 4,
      vignette: 5,
    };
    this.stride = {
      VERTICES: 8,
      ADDDATA: 8,
      INDICIES: 6,
      LIGHTS: 9,
    };
    this.typesOfLights = {
      radial: 0,
      point: 1,
    };
    this.options = {
      backgroundColor: [0, 0, 0, 255],
      maxQuadPerSceen: 1000,
      maxLightsPerSceen: 100,
      customCamera: false,
      bloom: true,
      bloomStrength: 16,
      lights: true,
    };
    this.vertices;
    this.addData;
    this.vertexBuffer;
    this.addDataBuffer;

    ///////////
    this.testMode = true;
    this.numberOfQuadsInBatch = 0;
    this.numberOfLightsInFrame = 0;
    this.numberOfGuiInFrame = 0;
    this.numberOfQuadsInBuffer = 0;

    this.vertexGUIBuffer;
    this.addDataGUIBuffer;
    this.indexBuffer;
    this.lightsDataBuffer;
    this.projectionBuffer;
    this.globalEffectBuffer;
    this.compositeDataBuffer;
    this.bloomXBuffer;
    this.bloomYBuffer;

    this.lightsData;
    this.customcameraMatrix = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    this.camera = undefined;
    this.indexBuffer = AuroraBuffer.createBufferMaped({
      data: [0, 1, 2, 1, 2, 3],
      bufferType: "index",
      type: "Uint32Array",
      label: "offscreenIndexBuffer",
    });
    this.pipelinesInFrame = [];
    this.universalSampler;
    this.linearSampler;
    this.fontData = {};
    this.colorCorrection = [1, 1, 1];
    this.GPUCalls = { render: 0, compute: 0 };
    this.renderGui = false;
  }
}
