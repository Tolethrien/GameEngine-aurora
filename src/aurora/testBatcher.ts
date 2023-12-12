import Aurora from "./auroraCore";
import AuroraPipeline from "./auroraPipeline";
import AuroraShader from "./auroraShader";
import offscreenShader from "./shaders/universalShader.wgsl?raw";
import postProcessShader from "./shaders/postProcess.wgsl?raw";
import blurShader from "./shaders/blur.wgsl?raw";
import tresholdShader from "./shaders/treshold.wgsl?raw";
import lightsShader from "./shaders/lights.wgsl?raw";
import compositionShader from "./shaders/compositionShader.wgsl?raw";
import { clamp, normalizeColor } from "../math/math";
import AuroraTexture, { GPULoadedTexture } from "./auroraTexture";
import AuroraBuffer from "./auroraBuffer";
import AuroraCamera from "./auroraCamera";
import radialL from "../assets/radial_small.png";

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
interface LightProps {
  type: LightType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  tint: [number, number, number];
  intensity: number;
}
type TextureAtlas = { texture: GPUTexture; sampler: GPUSampler };
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
  ADDDATA: 7,
  INDICIES: 6,
  LIGHTS: 9,
};

export default class AuroraBatcher {
  private static options: BatcherOptions;
  public static numberOfQuadsInBatch = 0;
  public static numberOfLightsInFrame = 0;
  private static vertexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;
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
  private static compositeData: Uint32Array;
  private static customcameraMatrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  private static camera: AuroraCamera | undefined;
  private static pipelinesInFrame: GPUCommandBuffer[] = [];
  private static textureAtlas: TextureAtlas & { name: string };
  private static offscreenTexture: GPULoadedTexture;
  private static offscreenTextureFloat: GPULoadedTexture;
  private static treshholdTexture: GPULoadedTexture;
  private static bloomPassOneTexture: GPULoadedTexture;
  private static bloomPassTwoTexture: GPULoadedTexture;
  private static lightsTexture: GPULoadedTexture;
  private static compositeTexture: GPULoadedTexture;
  private static radialLight: GPULoadedTexture;
  private static colorCorrection: [number, number, number] = [1, 1, 1];
  private static GPUCalls = { render: 0, compute: 0 };
  public static async createBatcher(options?: Partial<BatcherOptions>) {
    this.options = this.setOptions(options);
    await this.createBatcherTextures();
    this.createCamera();
    this.createOffscreenPipeline();
    this.createTresholdPipeline();
    this.crateBloomPipeline();
    this.crateLightsPipeline();
    this.createCompositePipeline();
    this.createPresentPipeline();
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
  public static async setTextures(texture: TextureAtlas) {
    this.textureAtlas = { ...texture, name: "textures" };
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
    intesity && (this.globalEffect[1] = clamp(intesity, 0, 1));
  }
  public static startBatch() {
    this.numberOfQuadsInBatch = 0;
    this.numberOfLightsInFrame = 0;
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
    this.startPresentPipeline();

    Aurora.device.queue.submit(this.pipelinesInFrame);
  }
  public static setCameraBuffer(matrix: Float32Array) {
    this.customcameraMatrix = matrix;
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
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES] = position.x;
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 1] = position.y;
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 2] = size.width;
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 3] =
      size.height;
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 4] = crop[0];
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 5] = crop[1];
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 6] = crop[2];
    this.vertices[this.numberOfQuadsInBatch * STRIDE.VERTICES + 7] = crop[3];
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA] = tint[0];
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 1] = tint[1];
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 2] = tint[2];
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 3] = alpha;
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 4] = textureToUse;
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 5] = isTexture;
    this.addData[this.numberOfQuadsInBatch * STRIDE.ADDDATA + 6] = bloom;
    this.numberOfQuadsInBatch++;
  }
  public static drawLight({
    intensity,
    position,
    size,
    tint,
    type,
  }: LightProps) {
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
  public static drawText() {
    //TODO: dodac renderowanie tekstu
  }
  public static drawGUI() {
    //TODO: dodac renderowanie UI(bez kamery na bazie procentów)
  }
  private static setOptions(options?: Partial<BatcherOptions>) {
    const template = { ...OPTIONS_TEMPLATE, ...options };
    template.backgroundColor = normalizeColor(template.backgroundColor);
    !template.customCamera && (this.camera = new AuroraCamera());

    return template;
  }
  private static async createBatcherTextures() {
    this.radialLight = await AuroraTexture.createTexture(
      "radialLight",
      radialL
    );
    this.offscreenTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "offscreenTexture"
    );
    this.offscreenTextureFloat = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "offscreenTexture",
      "rgba16float"
    );
    this.treshholdTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "tresholdTexture"
    );
    this.lightsTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "lightTexture"
    );
    this.bloomPassOneTexture = AuroraTexture.createStorageTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "bloomTexture"
    );

    this.bloomPassTwoTexture = AuroraTexture.createStorageTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "bloom2Texture"
    );

    this.compositeTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height,
      "compositeTexture"
    );
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
          shaderLocation: 6, // bloom, see vertex shader
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
            resource: this.textureAtlas.sampler,
          },
          {
            binding: 1,
            resource: this.textureAtlas.texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("offscreenPipelineLayout", [
      "userAssetsBind",
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
          view: this.offscreenTexture.texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.options.backgroundColor,
        },
        {
          view: this.offscreenTextureFloat.texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.options.backgroundColor,
        },
      ],
    });

    Aurora.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    Aurora.device.queue.writeBuffer(this.addDataBuffer, 0, this.addData);
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
            resource: this.offscreenTexture.texture.createView(),
          },
          {
            binding: 1,
            resource: this.treshholdTexture.texture.createView(),
          },
          {
            binding: 2,
            resource: this.bloomPassOneTexture.texture.createView(),
          },
          {
            binding: 3,
            resource: this.bloomPassTwoTexture.texture.createView(),
          },
          {
            binding: 4,
            resource: this.lightsTexture.texture.createView(),
          },
          {
            binding: 5,
            resource: this.compositeTexture.texture.createView(),
          },
          {
            binding: 6,
            resource: this.offscreenTextureFloat.texture.createView(),
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
            resource: this.compositeTexture.sampler,
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
    commandPass.draw(6, 8);
    commandPass.end();
    this.GPUCalls.render++;
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static createCompositePipeline() {
    //TODO: zrobic wybor pipelineow
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
            resource: this.offscreenTexture.sampler,
          },
          {
            binding: 1,
            resource: this.offscreenTexture.texture.createView(),
          },
          {
            binding: 2,
            resource: this.bloomPassTwoTexture.texture.createView(),
          },
          {
            binding: 3,
            resource: this.lightsTexture.texture.createView(),
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
          view: this.compositeTexture.texture.createView(),
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
          { binding: 0, resource: this.offscreenTexture.sampler },
          {
            binding: 1,
            resource: this.treshholdTexture.texture.createView(),
          },
          {
            binding: 2,
            resource: this.bloomPassOneTexture.texture.createView(),
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
          { binding: 0, resource: this.offscreenTexture.sampler },
          {
            binding: 1,
            resource: this.bloomPassOneTexture.texture.createView(),
          },
          {
            binding: 2,
            resource: this.bloomPassTwoTexture.texture.createView(),
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
            resource: this.offscreenTextureFloat.sampler,
          },
          {
            binding: 1,
            resource: this.offscreenTextureFloat.texture.createView(),
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
          view: this.treshholdTexture.texture.createView(),
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
            texture: { viewDimension: "2d" },
          },
        ],
        label: "lightsTextureBindLayout",
      },
      data: {
        label: "lightsTextureBindData",
        entries: [
          {
            binding: 0,
            resource: this.radialLight.sampler,
          },
          {
            binding: 1,
            resource: this.radialLight.texture.createView(),
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
    if (!this.options.lights) return;
    const universalEncoder = Aurora.device.createCommandEncoder();
    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.lightsTexture.texture.createView(),
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
}
