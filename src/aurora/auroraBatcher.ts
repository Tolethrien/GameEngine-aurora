import Aurora from "./auroraCore";
import AuroraPipeline from "./auroraPipeline";
import AuroraShader from "./auroraShader";
import offscreenShader from "./shaders/universalShader.wgsl?raw";
import guiShader from "./shaders/guiShader.wgsl?raw";
import postProcessShader from "./shaders/postProcess.wgsl?raw";
import postTestShader from "./shaders/postTest.wgsl?raw";
import blurShader from "./shaders/blur.wgsl?raw";
import tresholdShader from "./shaders/treshold.wgsl?raw";
import lightsShader from "./shaders/lights.wgsl?raw";
import compositionShader from "./shaders/compositionShader.wgsl?raw";
import { clamp, normalizeColor } from "../math/math";
import AuroraTexture from "./auroraTexture";
import AuroraBuffer from "./auroraBuffer";
import AuroraCamera from "./auroraCamera";
import radialL from "../assets/lights/radial.png";

interface SpriteProps {
  position: { x: number; y: number };
  size: { width: number; height: number };
  textureToUse: number;
  crop: Float32Array;
  tint: Uint8ClampedArray;
  alpha: number;
  isTexture: number;
  bloom: number;
}
interface GlyphSchema {
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
type BatcherOptions = typeof OPTIONS_TEMPLATE;
const OPTIONS_TEMPLATE = {
  backgroundColor: [0, 0, 0, 255],
  maxQuadPerSceen: 1000,
  maxLightsPerSceen: 100,
  customCamera: false,
  bloom: true,
  bloomStrength: 16,
  lights: true,
};
const TEXTURE_WARN =
  "AuroraBatcher Error: Batcher required 'textureStore' to by set to true(default) in 'Aurora.initialize()' options and initial textureArray named 'userTextureAtlas' to work.\nMake sure that you are crating this textureArray before calling 'AuroraBatcher.createBatcher()'. \n\nTIP: if you dont have textures yet you can create emptyTextureArray as a placeholder, just remember to set you drawQuad with 'isTexture:0'.";
type LightType = keyof typeof LIGHTS_TYPES;
const LIGHTS_TYPES = {
  radial: 0,
  point: 1,
};
type ScreenEffects = keyof typeof SCREEN_EFFECTS;
const SCREEN_EFFECTS = {
  none: 0,
  grayscale: 1,
  sepia: 2,
  invert: 3,
  chromaticAbber: 4,
  vignette: 5,
};
const STRIDE = {
  VERTICES: 8,
  ADDDATA: 8,
  INDICIES: 6,
  LIGHTS: 9,
};
export const TEST = false;
export default class AuroraBatcher {
  private static options: BatcherOptions;
  public static numberOfQuadsInBatch = 0;
  public static numberOfLightsInFrame = 0;
  public static numberOfGuiInFrame = 0;
  private static numberOfQuadsInBuffer = 0;
  private static vertexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;
  private static vertexGUIBuffer: GPUBuffer;
  private static addDataGUIBuffer: GPUBuffer;
  private static indexBuffer: GPUBuffer;
  private static lightsDataBuffer: GPUBuffer;
  private static projectionBuffer: GPUBuffer;
  private static globalEffectBuffer: GPUBuffer;
  private static compositeDataBuffer: GPUBuffer;
  private static bloomXBuffer: GPUBuffer;
  private static bloomYBuffer: GPUBuffer;
  private static vertices: Float32Array;
  private static addData: Uint32Array;
  private static lightsData: Uint32Array;
  private static globalEffect = new Float32Array([0, 0]);
  private static compositeData = new Uint32Array([1, 1]);
  private static customcameraMatrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  private static camera: AuroraCamera | undefined;
  private static pipelinesInFrame: GPUCommandBuffer[] = [];
  private static universalSampler: GPUSampler;
  private static linearSampler: GPUSampler;
  private static fontData: Record<number, Omit<GlyphSchema, "id">> = {};
  private static colorCorrection: [number, number, number] = [1, 1, 1];
  private static GPUCalls = { render: 0, compute: 0 };
  private static renderGui = false;

  public static async createBatcher(options?: Partial<BatcherOptions>) {
    !AuroraTexture.getStore.has("userTextureAtlas") &&
      console.error(TEXTURE_WARN);
    this.options = this.setOptions(options);
    await this.createBatcherTextures();
    this.createCamera();
    this.createOffscreenPipeline();
    this.createTresholdPipeline();
    this.crateBloomPipeline();
    this.crateLightsPipeline();
    this.createCompositePipeline();
    !TEST && this.createPresentPipeline();
    TEST && this.createTestPipeline();
    this.createGUIPipeline();
  }
  public static get getOptionsData() {
    return this.options;
  }
  public static get getRendererData() {
    return {
      lights: this.numberOfLightsInFrame,
      quads: this.numberOfQuadsInBatch,
      globalEffect: {
        type: Object.keys(SCREEN_EFFECTS)[
          this.globalEffect[0]
        ] as ScreenEffects,
        str: this.globalEffect[1],
      },
      colorCorr: this.colorCorrection,
    };
  }
  public static get getGPUCalls() {
    return this.GPUCalls;
  }

  public static setBloom(bloom: boolean, strength?: number) {
    this.options.bloom = bloom;
    strength && (this.options.bloomStrength = clamp(strength, 0, 50));
    this.compositeData[1] = bloom ? 1 : 0;
  }
  public static setLights(lights: boolean) {
    this.options.lights = lights;
    this.compositeData[0] = lights ? 1 : 0;
  }
  public static setGlobalColorCorrection(color: [number, number, number]) {
    this.colorCorrection = color;
  }
  public static setScreenShader(effect: ScreenEffects, intesity?: number) {
    this.globalEffect[0] = SCREEN_EFFECTS[effect];
    typeof intesity === "number" &&
      (console.log("s"), (this.globalEffect[1] = clamp(intesity, 0, 1)));
  }
  public static swapToGui() {
    this.renderGui = true;
  }
  public static startBatch() {
    this.numberOfQuadsInBatch = 0;
    this.numberOfLightsInFrame = 0;
    this.numberOfGuiInFrame = 0;
    this.numberOfQuadsInBuffer = 0;
    this.renderGui = false;
    this.pipelinesInFrame = [];
  }
  public static endBatch() {
    this.GPUCalls = { render: 0, compute: 0 };
    !this.options.customCamera && this.camera.update();
    Aurora.device.queue.writeBuffer(
      this.projectionBuffer,
      0,
      this.options.customCamera
        ? this.customcameraMatrix
        : this.camera.projectionViewMatrix.getMatrix
    );
    this.startOffscreenPipeline();
    this.startTresholdPipeline();
    this.startBloomPipeline();
    this.startLightsPipeline();
    this.startCompositePipeline();
    !TEST && this.startPresentPipeline();
    TEST && this.startTestPipeline();
    this.startGUIPipeline();

    Aurora.device.queue.submit(this.pipelinesInFrame);
  }
  public static setCameraBuffer(matrix: Float32Array) {
    this.customcameraMatrix = matrix;
  }
  public static async loadFont(
    bitmap: string,
    json: { symbols: GlyphSchema[] }
  ) {
    await AuroraTexture.createTextureArray({
      label: "fonts",
      urls: [bitmap, bitmap],
    });
    json.symbols.forEach((symbol) => {
      this.fontData[symbol.id] = {
        width: symbol.width,
        height: symbol.height,
        x: symbol.x,
        y: symbol.y,
        xoffset: symbol.xoffset,
        yoffset: symbol.yoffset,
        xadvance: symbol.xadvance,
      };
    });
  }
  public static drawQuad({
    position,
    size,
    textureToUse,
    crop,
    alpha,
    tint,
    isTexture,
    bloom,
  }: SpriteProps) {
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES] = position.x;
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 1] =
      position.y;
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 2] =
      size.width;
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 3] =
      size.height;
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 4] = crop[0];
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 5] = crop[1];
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 6] = crop[2];
    this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 7] = crop[3];
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA] = tint[0];
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 1] = tint[1];
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 2] = tint[2];
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 3] = alpha;
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 4] =
      textureToUse;
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 5] = isTexture;
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 6] = 0;
    this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 7] = bloom;
    this.numberOfQuadsInBuffer++;
    this.renderGui ? this.numberOfGuiInFrame++ : this.numberOfQuadsInBatch++;
  }
  public static drawLight({
    intensity,
    position,
    size,
    tint,
    type,
  }: LightProps) {
    if (this.renderGui) return;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS] =
      position.x;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 1] =
      position.y;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 2] =
      size.width;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 3] =
      size.height;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 4] =
      tint[0];
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 5] =
      tint[1];
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 6] =
      tint[2];
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 7] =
      intensity;
    this.lightsData[(1 + this.numberOfLightsInFrame) * STRIDE.LIGHTS + 8] =
      LIGHTS_TYPES[type];
    this.numberOfLightsInFrame++;
  }
  public static drawText({
    alpha,
    bloom,
    color,
    position,
    textureToUse,
    weight,
    text,
  }: TextProps) {
    //TODO: znormalizowac jesli renderujesz UI
    let xPos = position.x;
    const { height: imgHeight, width: imgWidth } =
      AuroraTexture.getTexture("fonts").meta;
    Array.from(text).forEach((char) => {
      const glyph = this.fontData[char.charCodeAt(0)];
      let width, height, advence, offsetY;
      if (this.renderGui) {
        width = (glyph.width * weight) / Aurora.canvas.width;
        height = (glyph.height * weight) / Aurora.canvas.height;
        advence = (glyph.xadvance * weight) / Aurora.canvas.width;
        offsetY = (glyph.yoffset * weight) / Aurora.canvas.height;
      } else {
        width = glyph.width * weight;
        height = glyph.height * weight;
        advence = glyph.xadvance * weight;
        offsetY = glyph.yoffset * weight;
      }
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES] =
        xPos + width / 2;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 1] =
        position.y + height / 2 + (this.renderGui ? 0 : offsetY);
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 2] =
        width / 2;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 3] =
        height / 2;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 4] =
        glyph.x / imgWidth;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 5] =
        glyph.y / imgHeight;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 6] =
        glyph.x / imgWidth + glyph.width / imgWidth;
      this.vertices[this.numberOfQuadsInBuffer * STRIDE.VERTICES + 7] =
        glyph.y / imgHeight + glyph.height / imgHeight;
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA] = color[0];
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 1] = color[1];
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 2] = color[2];
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 3] = alpha;
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 4] =
        textureToUse;
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 5] = 0;
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 6] = 1;
      this.addData[this.numberOfQuadsInBuffer * STRIDE.ADDDATA + 7] = bloom;
      this.numberOfQuadsInBuffer++;
      this.renderGui ? this.numberOfGuiInFrame++ : this.numberOfQuadsInBatch++;
      xPos += advence;
    });
  }

  private static setOptions(options?: Partial<BatcherOptions>) {
    const template = { ...OPTIONS_TEMPLATE, ...options };
    template.backgroundColor = normalizeColor(template.backgroundColor);
    !template.customCamera && (this.camera = new AuroraCamera());

    return template;
  }
  private static async createBatcherTextures() {
    this.universalSampler = AuroraTexture.createSampler();
    this.linearSampler = AuroraTexture.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    await AuroraTexture.createTextureArray({
      label: "lightsList",
      urls: [radialL, radialL],
    });

    AuroraTexture.createEmptyTexture({
      label: "offscreenTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createEmptyTexture({
      label: "offscreenTextureFloat",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
      format: "rgba16float",
    });
    AuroraTexture.createEmptyTexture({
      label: "treshholdTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createEmptyTexture({
      label: "lightsTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createEmptyTexture({
      label: "bloomPassOneTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createEmptyTexture({
      label: "bloomPassTwoTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createEmptyTexture({
      label: "compositeTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
  }
  private static createCamera() {
    this.projectionBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      typedArr: this.options.customCamera
        ? this.customcameraMatrix
        : this.camera.projectionViewMatrix.getMatrix,
      label: "CameraBuffer",
    });
    AuroraPipeline.addBindGroup({
      name: "cameraBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ],
        label: "cameraBindLayout",
      },
      data: {
        label: "cameraBindData",
        entries: [{ binding: 0, resource: { buffer: this.projectionBuffer } }],
      },
    });
  }
  private static createOffscreenPipeline() {
    this.vertices = new Float32Array(
      this.options.maxQuadPerSceen * STRIDE.VERTICES
    );
    this.addData = new Uint32Array(
      this.options.maxQuadPerSceen * STRIDE.ADDDATA
    );
    AuroraPipeline.createVertexBufferLayout("offscreenVertexBufferLayout", {
      arrayStride: STRIDE.VERTICES * Float32Array.BYTES_PER_ELEMENT,
      stepMode: "instance",
      attributes: [
        {
          format: "float32x2",
          offset: 0,
          shaderLocation: 0, // Position, see vertex shader
        },
        {
          format: "float32x2",
          offset: 2 * Float32Array.BYTES_PER_ELEMENT,
          shaderLocation: 1, // size, see vertex shader
        },
        {
          format: "float32x4",
          offset: 4 * Float32Array.BYTES_PER_ELEMENT,
          shaderLocation: 2, // crop, see vertex shader
        },
      ],
    });
    AuroraPipeline.createVertexBufferLayout("offscreenAddDataBufferLayout", {
      arrayStride: STRIDE.ADDDATA * Uint32Array.BYTES_PER_ELEMENT,
      stepMode: "instance",
      attributes: [
        {
          format: "uint32x4",
          offset: 0,
          shaderLocation: 3, // color, see vertex shader
        },
        {
          format: "uint32",
          offset: 4 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 4, // textureIndex, see vertex shader
        },
        {
          format: "uint32",
          offset: 5 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 5, // isTextureOrColor, see vertex shader
        },
        {
          format: "uint32",
          offset: 6 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 6, // isText, see vertex shader
        },
        {
          format: "uint32",
          offset: 7 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 7, // bloom, see vertex shader
        },
      ],
    });

    this.vertexBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.vertices,
      label: "offscreenVertexBuffer",
    });
    this.addDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.addData,
      label: "offscreenAddDataBuffer",
    });
    this.indexBuffer = AuroraBuffer.createBufferMaped({
      data: [0, 1, 2, 1, 2, 3],
      bufferType: "index",
      type: "Uint32Array",
      label: "offscreenIndexBuffer",
    });

    AuroraPipeline.addBindGroup({
      name: "userAssetsBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" },
          },
        ],
        label: "userAssetsBindLayout",
      },
      data: {
        label: "userAssetsBindData",
        entries: [
          {
            binding: 0,
            resource: this.universalSampler,
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("userTextureAtlas").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "textBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" },
          },
        ],
        label: "textBindLayout",
      },
      data: {
        label: "textBindData",
        entries: [
          {
            binding: 0,
            resource: this.linearSampler,
          },
          {
            binding: 1,
            resource: AuroraTexture.getTexture("fonts").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("offscreenPipelineLayout", [
      "userAssetsBind",
      "textBind",
      "cameraBind",
    ]);
    AuroraShader.addShader("offscreenShader", offscreenShader);
    AuroraPipeline.createVertexBufferLayoutGroup(
      "offscreenBuffersGroupLayout",
      ["offscreenVertexBufferLayout", "offscreenAddDataBufferLayout"]
    );
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup(
        "offscreenBuffersGroupLayout"
      ),
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "offscreenPipelineLayout"
      ),
      pipelineName: "offscreenPipeline",
      shader: AuroraShader.getSader("offscreenShader"),
      colorTargets: [
        AuroraPipeline.getColorTargetTemplate("standard"),
        AuroraPipeline.getColorTargetTemplate("oversaturated"),
      ],
    });
  }

  private static startOffscreenPipeline() {
    const universalEncoder = Aurora.device.createCommandEncoder();
    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture(
            "offscreenTexture"
          ).texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.options.backgroundColor,
        },
        {
          view: AuroraTexture.getTexture(
            "offscreenTextureFloat"
          ).texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.options.backgroundColor,
        },
      ],
    });

    Aurora.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices, 0);
    Aurora.device.queue.writeBuffer(this.addDataBuffer, 0, this.addData, 0);
    AuroraPipeline.getBindsFromLayout("offscreenPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("offscreenPipeline"));
    commandPass.setVertexBuffer(0, this.vertexBuffer);
    commandPass.setVertexBuffer(1, this.addDataBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(STRIDE.INDICIES, this.numberOfQuadsInBatch);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(universalEncoder.finish());
  }
  private static createTestPipeline() {
    this.globalEffectBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "globalEffectBuffer",
      typedArr: this.globalEffect,
    });
    AuroraShader.addShader("postTestShader", postTestShader);
    AuroraPipeline.addBindGroup({
      name: "compositionTextureBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 5,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 6,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
        ],
        label: "compositionTextureBindLayout",
      },
      data: {
        label: "compositionTextureBindData",
        entries: [
          {
            binding: 0,
            resource:
              AuroraTexture.getTexture("offscreenTexture").texture.createView(),
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("treshholdTexture").texture.createView(),
          },
          {
            binding: 2,
            resource: AuroraTexture.getTexture(
              "bloomPassOneTexture"
            ).texture.createView(),
          },
          {
            binding: 3,
            resource: AuroraTexture.getTexture(
              "bloomPassTwoTexture"
            ).texture.createView(),
          },
          {
            binding: 4,
            resource:
              AuroraTexture.getTexture("lightsTexture").texture.createView(),
          },
          {
            binding: 5,
            resource:
              AuroraTexture.getTexture("compositeTexture").texture.createView(),
          },
          {
            binding: 6,
            resource: AuroraTexture.getTexture(
              "offscreenTextureFloat"
            ).texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "globalEffectBind",
      layout: {
        entries: [
          {
            binding: 0,
            buffer: { type: "uniform" },
            visibility: GPUShaderStage.FRAGMENT,
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
        ],
        label: "globalEffectBindLayout",
      },
      data: {
        entries: [
          { binding: 0, resource: { buffer: this.globalEffectBuffer } },
          {
            binding: 1,
            resource: this.universalSampler,
          },
        ],
        label: "globalEffectBindData",
      },
    });
    AuroraPipeline.createPipelineLayout("presentPipelineLayout", [
      "globalEffectBind",
      "compositionTextureBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "presentPipelineLayout"
      ),
      pipelineName: "presentPipeline",

      shader: AuroraShader.getSader("postTestShader"),
    });
  }
  private static createPresentPipeline() {
    this.globalEffectBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "globalEffectBuffer",
      typedArr: this.globalEffect,
    });
    AuroraShader.addShader("postProcessShader", postProcessShader);
    AuroraPipeline.addBindGroup({
      name: "compositionTextureBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
        ],
        label: "compositionTextureBindLayout",
      },
      data: {
        label: "compositionTextureBindData",
        entries: [
          {
            binding: 0,
            resource:
              AuroraTexture.getTexture("compositeTexture").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "globalEffectBind",
      layout: {
        entries: [
          {
            binding: 0,
            buffer: { type: "uniform" },
            visibility: GPUShaderStage.FRAGMENT,
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
        ],
        label: "globalEffectBindLayout",
      },
      data: {
        entries: [
          { binding: 0, resource: { buffer: this.globalEffectBuffer } },
          {
            binding: 1,
            resource: this.universalSampler,
          },
        ],
        label: "globalEffectBindData",
      },
    });
    AuroraPipeline.createPipelineLayout("presentPipelineLayout", [
      "globalEffectBind",
      "compositionTextureBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "presentPipelineLayout"
      ),
      pipelineName: "presentPipeline",

      shader: AuroraShader.getSader("postProcessShader"),
    });
  }
  private static startPresentPipeline() {
    const globalEffectEncoder = Aurora.device.createCommandEncoder();
    const commandPass = globalEffectEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    Aurora.device.queue.writeBuffer(
      this.globalEffectBuffer,
      0,
      this.globalEffect
    );
    AuroraPipeline.getBindsFromLayout("presentPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("presentPipeline"));
    commandPass.draw(6);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static startTestPipeline() {
    const globalEffectEncoder = Aurora.device.createCommandEncoder();
    const commandPass = globalEffectEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    Aurora.device.queue.writeBuffer(
      this.globalEffectBuffer,
      0,
      this.globalEffect
    );
    AuroraPipeline.getBindsFromLayout("presentPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("presentPipeline"));
    commandPass.draw(6, 8);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static createCompositePipeline() {
    this.compositeData = new Uint32Array([1, 1]);
    this.compositeDataBuffer = AuroraBuffer.createDynamicBuffer({
      label: "compositeBuffer",
      bufferType: "uniform",
      typedArr: this.compositeData,
    });
    AuroraShader.addShader("compositionShader", compositionShader);
    AuroraPipeline.addBindGroup({
      name: "compositionUniformBind",
      layout: {
        label: "compositionUniformBindLayout",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {
              type: "uniform",
            },
          },
        ],
      },
      data: {
        label: "compositionUniformBindData",
        entries: [
          { binding: 0, resource: { buffer: this.compositeDataBuffer } },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "compositionTexturesBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
        ],
        label: "compositionTexturesBindLayout",
      },
      data: {
        label: "compositionTexturesBindData",
        entries: [
          {
            binding: 0,
            resource: this.universalSampler,
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("offscreenTexture").texture.createView(),
          },
          {
            binding: 2,
            resource: AuroraTexture.getTexture(
              "bloomPassTwoTexture"
            ).texture.createView(),
          },
          {
            binding: 3,
            resource:
              AuroraTexture.getTexture("lightsTexture").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("compositionPipelineLayout", [
      "compositionTexturesBind",
      "compositionUniformBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "compositionPipelineLayout"
      ),
      pipelineName: "compositionPipeline",
      colorTargets: [AuroraPipeline.getColorTargetTemplate("post-process")],
      shader: AuroraShader.getSader("compositionShader"),
    });
  }
  private static startCompositePipeline() {
    const compositionEncoder = Aurora.device.createCommandEncoder();
    const commandPass = compositionEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture(
            "compositeTexture"
          ).texture.createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    Aurora.device.queue.writeBuffer(
      this.compositeDataBuffer,
      0,
      this.compositeData
    );
    AuroraPipeline.getBindsFromLayout("compositionPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("compositionPipeline"));
    commandPass.draw(6, 1);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(compositionEncoder.finish());
  }
  private static crateBloomPipeline() {
    this.bloomXBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "bloomXBuffer",
      typedArr: new Uint32Array([0, this.options.bloomStrength]),
    });
    this.bloomYBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "bloomYBuffer",
      typedArr: new Uint32Array([1, this.options.bloomStrength]),
    });

    AuroraShader.addShader("bloomShader", blurShader);
    AuroraPipeline.addBindGroup({
      name: "bloomXPassBind",
      layout: {
        label: "bloomXPassBindLayout",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              viewDimension: "2d",
              format: "bgra8unorm",
              access: "write-only",
            },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
        ],
      },
      data: {
        label: "bloomXPassBindData",
        entries: [
          { binding: 0, resource: this.linearSampler },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("treshholdTexture").texture.createView(),
          },
          {
            binding: 2,
            resource: AuroraTexture.getTexture(
              "bloomPassOneTexture"
            ).texture.createView(),
          },
          { binding: 3, resource: { buffer: this.bloomXBuffer } },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "bloomYPassBind",
      layout: {
        label: "bloomYPassBindLayout",
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            texture: { viewDimension: "2d" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              viewDimension: "2d",
              format: "bgra8unorm",
              access: "write-only",
            },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
        ],
      },
      data: {
        label: "bloomYPassBindData",
        entries: [
          { binding: 0, resource: this.linearSampler },
          {
            binding: 1,
            resource: AuroraTexture.getTexture(
              "bloomPassOneTexture"
            ).texture.createView(),
          },
          {
            binding: 2,
            resource: AuroraTexture.getTexture(
              "bloomPassTwoTexture"
            ).texture.createView(),
          },
          { binding: 3, resource: { buffer: this.bloomYBuffer } },
        ],
      },
    });

    AuroraPipeline.createPipelineLayout("bloomXPipelineLayout", [
      "bloomXPassBind",
    ]);
    AuroraPipeline.createPipelineLayout("bloomYPipelineLayout", [
      "bloomYPassBind",
    ]);

    AuroraPipeline.createComputePipeline({
      pipelineName: "bloomPipeline",
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "bloomXPipelineLayout"
      ),
      shader: AuroraShader.getSader("bloomShader"),
    });
  }
  private static startBloomPipeline() {
    if (!this.options.bloom) return;
    Aurora.device.queue.writeBuffer(
      this.bloomXBuffer,
      0,
      new Uint32Array([0, this.options.bloomStrength])
    );
    Aurora.device.queue.writeBuffer(
      this.bloomYBuffer,
      0,
      new Uint32Array([1, this.options.bloomStrength])
    );
    const commandEncoder = Aurora.device.createCommandEncoder();
    const commandPass = commandEncoder.beginComputePass();
    //==========
    commandPass.setPipeline(AuroraPipeline.getPipeline("bloomPipeline"));
    AuroraPipeline.getBindsFromLayout("bloomXPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.dispatchWorkgroups(
      Math.ceil(Aurora.canvas.width / (128 - (this.options.bloomStrength - 1))),
      Math.ceil(Aurora.canvas.height / 4)
    );
    AuroraPipeline.getBindsFromLayout("bloomYPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.dispatchWorkgroups(
      Math.ceil(
        Aurora.canvas.height / (128 - (this.options.bloomStrength - 1))
      ),
      Math.ceil(Aurora.canvas.width / 4)
    );
    commandPass.end();
    this.GPUCalls.compute += 2;
    this.pipelinesInFrame.push(commandEncoder.finish());
  }
  private static createTresholdPipeline() {
    AuroraShader.addShader("tresholdShader", tresholdShader);
    AuroraPipeline.addBindGroup({
      name: "tresholdTextureBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
        ],
        label: "tresholdTextureBindLayout",
      },
      data: {
        label: "tresholdTextureBindData",
        entries: [
          {
            binding: 0,
            resource: this.universalSampler,
          },
          {
            binding: 1,
            resource: AuroraTexture.getTexture(
              "offscreenTextureFloat"
            ).texture.createView(),
          },
        ],
      },
    });

    AuroraPipeline.createPipelineLayout("tresholdPipelineLayout", [
      "tresholdTextureBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "tresholdPipelineLayout"
      ),
      pipelineName: "tresholdPipeline",
      shader: AuroraShader.getSader("tresholdShader"),
    });
  }
  private static startTresholdPipeline() {
    if (!this.options.bloom) return;
    const globalEffectEncoder = Aurora.device.createCommandEncoder();
    const commandPass = globalEffectEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture(
            "treshholdTexture"
          ).texture.createView(),

          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    AuroraPipeline.getBindsFromLayout("tresholdPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );

    commandPass.setPipeline(AuroraPipeline.getPipeline("tresholdPipeline"));
    commandPass.draw(6, 1);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static crateLightsPipeline() {
    this.lightsData = new Uint32Array(
      this.options.maxLightsPerSceen * STRIDE.LIGHTS + STRIDE.LIGHTS
    );
    Array(9)
      .fill(null)
      .forEach((_, index) => (this.lightsData[index] = 0));
    this.lightsDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.lightsData,
      label: "lightsBuffer",
    });
    AuroraPipeline.createVertexBufferLayout("lightsVertexLayout", {
      arrayStride: STRIDE.LIGHTS * Uint32Array.BYTES_PER_ELEMENT,
      stepMode: "instance",
      attributes: [
        {
          format: "uint32x2",
          offset: 0,
          shaderLocation: 0, //position
        },
        {
          format: "uint32x2",
          offset: 2 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 1, //size
        },
        {
          format: "uint32x3",
          offset: 4 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 2, // tint
        },
        {
          format: "uint32",
          offset: 7 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 3, //intensity
        },
        {
          format: "uint32",
          offset: 8 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 4, //type
        },
      ],
    });
    AuroraPipeline.addBindGroup({
      name: "lightsTextureBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" },
          },
        ],
        label: "lightsTextureBindLayout",
      },
      data: {
        label: "lightsTextureBindData",
        entries: [
          {
            binding: 0,
            resource: this.linearSampler,
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("lightsList").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("lightsPipelineLayout", [
      "lightsTextureBind",
      "cameraBind",
    ]);
    AuroraShader.addShader("lightsShader", lightsShader);
    AuroraPipeline.createVertexBufferLayoutGroup("lightsBuffersLayout", [
      "lightsVertexLayout",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup("lightsBuffersLayout"),
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "lightsPipelineLayout"
      ),
      pipelineName: "lightsPipeline",
      colorTargets: [AuroraPipeline.getColorTargetTemplate("post-process")],

      shader: AuroraShader.getSader("lightsShader"),
    });
  }
  private static startLightsPipeline() {
    //TODO: dodac rozne rodzaje swiatel i zrobic array ich
    if (!this.options.lights) return;
    const universalEncoder = Aurora.device.createCommandEncoder();

    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture("lightsTexture").texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [...this.colorCorrection, 1],
        },
      ],
    });
    Aurora.device.queue.writeBuffer(this.lightsDataBuffer, 0, this.lightsData);
    AuroraPipeline.getBindsFromLayout("lightsPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("lightsPipeline"));
    commandPass.setVertexBuffer(0, this.lightsDataBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(STRIDE.INDICIES, 1 + this.numberOfLightsInFrame);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(universalEncoder.finish());
  }
  private static createGUIPipeline() {
    this.vertexGUIBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.vertices,
      label: "offscreenVertexGUIBuffer",
    });
    this.addDataGUIBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.addData,
      label: "offscreenAddDataGUIBuffer",
    });

    AuroraPipeline.addBindGroup({
      name: "userGUIBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" },
          },
        ],
        label: "userGUIBindLayout",
      },
      data: {
        label: "userGUIBindBindData",
        entries: [
          {
            binding: 0,
            resource: this.universalSampler,
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("userTextureAtlas").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "textBind",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d-array" },
          },
        ],
        label: "textBindLayout",
      },
      data: {
        label: "textBindData",
        entries: [
          {
            binding: 0,
            resource: this.linearSampler,
          },
          {
            binding: 1,
            resource: AuroraTexture.getTexture("fonts").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("guiPipelineLayout", [
      "userGUIBind",
      "textBind",
    ]);
    AuroraShader.addShader("guiShader", guiShader);

    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup(
        "offscreenBuffersGroupLayout"
      ),
      pipelineLayout:
        AuroraPipeline.getRenderPipelineLayout("guiPipelineLayout"),
      pipelineName: "guiPipeline",
      shader: AuroraShader.getSader("guiShader"),
      colorTargets: [AuroraPipeline.getColorTargetTemplate("standard")],
    });
  }
  private static startGUIPipeline() {
    if (this.numberOfGuiInFrame === 0) return;

    const guiEncoder = Aurora.device.createCommandEncoder();
    const commandPass = guiEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "load",
          storeOp: "store",
          clearValue: [0, 0, 0, 0],
        },
      ],
    });

    Aurora.device.queue.writeBuffer(
      this.vertexGUIBuffer,
      0,
      this.vertices,
      this.numberOfQuadsInBatch * STRIDE.VERTICES
    );
    Aurora.device.queue.writeBuffer(
      this.addDataGUIBuffer,
      0,
      this.addData,
      this.numberOfQuadsInBatch * STRIDE.ADDDATA
    );
    AuroraPipeline.getBindsFromLayout("guiPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("guiPipeline"));
    commandPass.setVertexBuffer(0, this.vertexGUIBuffer);
    commandPass.setVertexBuffer(1, this.addDataGUIBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(STRIDE.INDICIES, this.numberOfGuiInFrame);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(guiEncoder.finish());
  }
}
