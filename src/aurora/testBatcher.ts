import Aurora from "./auroraCore";
import AuroraPipeline from "./auroraPipeline";
import AuroraShader from "./auroraShader";
import uniShader from "./shaders/universalShader.wgsl?raw";
import postProcessShader from "./shaders/postProcess.wgsl?raw";
import blurShader from "./shaders/blur.wgsl?raw";
import tresholdShader from "./shaders/treshold.wgsl?raw";
import lightShader from "./shaders/lights.wgsl?raw";
import compositionShader from "./shaders/compositionShader.wgsl?raw";
import { clamp, normalizeColor } from "../math/math";
import AuroraTexture, { GPULoadedTexture } from "./auroraTexture";
import AuroraBuffer from "./auroraBuffer";
import AuroraCamera from "./auroraCamera";
import radialL from "../assets/radial_small.png";
import background from "../assets/1.png";

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
type BatcherOptions = Partial<typeof OPTIONS_TEMPLATE>;
const OPTIONS_TEMPLATE = {
  backgroundColor: [0, 0, 0, 255],
  maxQuadPerBatch: 10000,
  LightsPerFrame: 100,
  customCamera: false,
  bloomStrength: 34,
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
const VERTEX_ATT_COUNT = 8;
const ADDDATA_ATT_COUNT = 7;
const INDICIES_PER_QUAD = 6;
const LIGHT_ATT_PER_SPRITE = 9;

export default class AuroraBatcher {
  public static numberOfQuadsInBatch = 0;
  public static numberOfLightsInFrame = 0;
  public static maxNumberOfQuads = OPTIONS_TEMPLATE.maxQuadPerBatch;
  private static vertexBuffer: GPUBuffer;
  private static indexBuffer: GPUBuffer;
  private static lightsDataBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;
  private static projectionBuffer: GPUBuffer;
  private static globalEffectBuffer: GPUBuffer;
  private static compositeDataBuffer: GPUBuffer;
  private static bloomXBuffer: GPUBuffer;
  private static bloomYBuffer: GPUBuffer;
  private static vertices: Float32Array;
  private static addData: Uint32Array;
  private static lightsData: Uint32Array;
  private static globalEffect: Float32Array;
  private static compositeData: Uint32Array;

  private static pipelinesInFrame: GPUCommandBuffer[] = [];
  private static pipelinesToUseInFrame = {
    bloom: false,
    light: false,
    globalEffect: false,
  };
  private static options: BatcherOptions;

  private static camera: AuroraCamera | undefined;
  public static test = true;
  private static customcameraMatrix: Float32Array = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  private static textureAtlas: TextureAtlas & { name: string };
  //new=================
  private static offscreenTexture: GPULoadedTexture;
  private static offscreenTextureFloat: GPULoadedTexture;
  private static treshholdTexture: GPULoadedTexture;
  private static bloomPassOneTexture: GPULoadedTexture;
  private static bloomPassTwoTexture: GPULoadedTexture;
  private static lightsTexture: GPULoadedTexture;
  private static compositeTexture: GPULoadedTexture;
  private static radialLight: GPULoadedTexture;
  private static back: GPULoadedTexture;

  //=============================

  public static async createBatcher(options?: BatcherOptions) {
    this.options = this.setOptions(options);
    await this.createBatcherTextures();
    this.createOffscreenPipeline();
    this.createTresholdPipeline();
    this.crateBloomPipeline();
    this.crateLightsPipeline();
    this.createCompositePipeline();
    this.createPresentPipeline();
  }

  public static async setTextures(texture: TextureAtlas) {
    this.textureAtlas = { ...texture, name: "textures" };
  }
  public static startBatch() {
    this.numberOfQuadsInBatch = 0;
    this.numberOfLightsInFrame = 0;
    this.pipelinesInFrame = [];
    this.pipelinesToUseInFrame = {
      bloom: true,
      light: false,
      globalEffect: false,
    };
  }
  public static endBatch() {
    !this.options.customCamera && this.camera.update();
    //compute
    this.startOffscreenPipeline();
    //composition
    this.startTresholdPipeline();
    this.startBloomPipeline();
    this.startLightsPipeline();
    this.startCompositePipeline();
    //final
    this.startPresentPipeline();
    Aurora.device.queue.submit(this.pipelinesInFrame);
  }
  public static setCameraBuffer(matrix: Float32Array) {
    this.customcameraMatrix = matrix;
  }
  public static applyScreenShader(effect: ScreenEffects, intesity: number) {
    const intens = clamp(intesity, 0, 1);
    this.pipelinesToUseInFrame.globalEffect = true;
    this.globalEffect[0] = SCREEN_EFFECTS[effect];
    this.globalEffect[1] = intens;
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
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT] = position.x;
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 1] =
      position.y;
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 2] =
      size.width;
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 3] =
      size.height;
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 4] = crop[0];
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 5] = crop[1];
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 6] = crop[2];
    this.vertices[this.numberOfQuadsInBatch * VERTEX_ATT_COUNT + 7] = crop[3];
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT] = tint[0];
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 1] = tint[1];
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 2] = tint[2];
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 3] = alpha;
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 4] =
      textureToUse;
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 5] = isTexture;
    this.addData[this.numberOfQuadsInBatch * ADDDATA_ATT_COUNT + 6] = bloom;
    this.numberOfQuadsInBatch++;
  }
  public static drawLight({
    intensity,
    position,
    size,
    tint,
    type,
  }: LightProps) {
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE] =
      position.x;
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 1] =
      position.y;
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 2] =
      size.width;
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 3] =
      size.height;
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 4] =
      tint[0];
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 5] =
      tint[1];
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 6] =
      tint[2];
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 7] =
      intensity;
    this.lightsData[this.numberOfLightsInFrame * LIGHT_ATT_PER_SPRITE + 8] =
      LIGHTS_TYPES[type];
    this.numberOfLightsInFrame++;
  }
  private static setOptions(options?: BatcherOptions) {
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
    this.back = await AuroraTexture.createTexture("back", background);
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
  private static createOffscreenPipeline() {
    this.vertices = new Float32Array(this.maxNumberOfQuads * VERTEX_ATT_COUNT);
    this.addData = new Uint32Array(this.maxNumberOfQuads * ADDDATA_ATT_COUNT);
    AuroraPipeline.createVertexBufferLayout("universalVertexBufferLayout", {
      arrayStride: VERTEX_ATT_COUNT * Float32Array.BYTES_PER_ELEMENT,
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
    AuroraPipeline.createVertexBufferLayout("universalAddDataBufferLayout", {
      arrayStride: ADDDATA_ATT_COUNT * Uint32Array.BYTES_PER_ELEMENT,
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

    this.addDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.addData,
      label: "universalAddDataBuffer",
    });
    this.vertexBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.vertices,
      label: "universalVertexBuffer",
    });
    this.indexBuffer = AuroraBuffer.createBufferMaped({
      data: [0, 1, 2, 1, 2, 3],
      bufferType: "index",
      type: "Uint32Array",
      label: "universalIndexBuffer",
    });
    this.projectionBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      typedArr: this.options.customCamera
        ? this.customcameraMatrix
        : this.camera.projectionViewMatrix.getMatrix,
      label: "universalCameraBuffer",
    });
    AuroraPipeline.addBindGroup({
      name: "camera",
      layout: {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ],
        label: "camera",
      },
      data: {
        label: "camera renderer bind group",
        entries: [{ binding: 0, resource: { buffer: this.projectionBuffer } }],
      },
    });
    AuroraPipeline.addBindGroup({
      name: this.textureAtlas.name,
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
        label: "texture",
      },
      data: {
        label: "textures renderer bind group",
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
    AuroraPipeline.createPipelineLayout("universal", [
      this.textureAtlas.name,
      "camera",
    ]);
    AuroraShader.addShader("universalShader", uniShader);
    AuroraPipeline.createVertexBufferLayoutGroup(
      "universalBuffersGroupLayout",
      ["universalVertexBufferLayout", "universalAddDataBufferLayout"]
    );
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup(
        "universalBuffersGroupLayout"
      ),
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout("universal"),
      pipelineName: "universal pipeline",
      shader: AuroraShader.getSader("universalShader"),
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
          clearValue: [0.5, 0.5, 0.5, 1],
        },
        {
          view: this.offscreenTextureFloat.texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 1],
        },
      ],
    });
    Aurora.device.queue.writeBuffer(
      this.projectionBuffer,
      0,
      this.options.customCamera
        ? this.customcameraMatrix
        : this.camera.projectionViewMatrix.getMatrix
    );
    Aurora.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    Aurora.device.queue.writeBuffer(this.addDataBuffer, 0, this.addData);
    AuroraPipeline.getBindsFromLayout("universal").forEach((bind, index) => {
      commandPass.setBindGroup(index, bind);
    });
    commandPass.setPipeline(AuroraPipeline.getPipeline("universal pipeline"));
    commandPass.setVertexBuffer(0, this.vertexBuffer);
    commandPass.setVertexBuffer(1, this.addDataBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(INDICIES_PER_QUAD, this.numberOfQuadsInBatch);
    commandPass.end();
    this.pipelinesInFrame.push(universalEncoder.finish());
  }
  private static createPresentPipeline() {
    this.globalEffect = new Float32Array([0, 0.5]);
    this.globalEffectBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "",
      typedArr: this.globalEffect,
    });
    AuroraShader.addShader("testShader", postProcessShader);
    AuroraPipeline.addBindGroup({
      name: "globalTextures",
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
        label: "textures",
      },
      data: {
        label: "textures renderer bind group",
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
      name: "globalEffectAddData",
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
      "globalEffectAddData",
      "globalTextures",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "presentPipelineLayout"
      ),
      pipelineName: "presentPipeline",

      shader: AuroraShader.getSader("testShader"),
    });
  }
  private static startPresentPipeline() {
    if (!this.pipelinesToUseInFrame.globalEffect && this.globalEffect[0] !== 0)
      this.globalEffect[0] = 0;
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
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static createCompositePipeline() {
    //bloom = 1
    // lightmap = 2
    this.compositeData = new Uint32Array([1, 2]);
    this.compositeDataBuffer = AuroraBuffer.createDynamicBuffer({
      label: "compositeBuffer",
      bufferType: "uniform",
      typedArr: this.compositeData,
    });
    AuroraShader.addShader("compositionShader", compositionShader);
    AuroraPipeline.addBindGroup({
      name: "compositionData",
      layout: {
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
        entries: [
          { binding: 0, resource: { buffer: this.compositeDataBuffer } },
        ],
      },
    });
    AuroraPipeline.addBindGroup({
      name: "compositionTextures",
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
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d" },
          },
        ],
        label: "texture",
      },
      data: {
        label: "textures renderer bind group",
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
          {
            binding: 4,
            resource: this.offscreenTextureFloat.texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("compositionPipelineLayout", [
      "compositionTextures",
      "compositionData",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "compositionPipelineLayout"
      ),
      pipelineName: "composition pipeline",
      shader: AuroraShader.getSader("compositionShader"),
    });
  }
  private static startCompositePipeline() {
    //TODO: nie komponowac niepotrzebnych tekstur na obraz kiedy np nie uzywasz ich. np nie dodawaj quadu bloomu jesli jest off
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

    commandPass.setPipeline(AuroraPipeline.getPipeline("composition pipeline"));
    commandPass.draw(6, 1);
    commandPass.end();
    this.pipelinesInFrame.push(compositionEncoder.finish());
  }
  private static crateBloomPipeline() {
    this.bloomXBuffer = AuroraBuffer.createBufferMaped({
      bufferType: "uniform",
      label: "bloomXBuffer",
      type: "Uint32Array",
      data: [0, this.options.bloomStrength],
    });
    this.bloomYBuffer = AuroraBuffer.createBufferMaped({
      bufferType: "uniform",
      label: "bloomYBuffer",
      type: "Uint32Array",
      data: [1, this.options.bloomStrength],
    });

    AuroraShader.addShader("bloomShader", blurShader);
    AuroraPipeline.addBindGroup({
      name: "bloomXPass",
      data: {
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
      layout: {
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
    });
    AuroraPipeline.addBindGroup({
      name: "bloomYPass",
      data: {
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
      layout: {
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
    });

    AuroraPipeline.createPipelineLayout("bloomXPipelineLayout", ["bloomXPass"]);
    AuroraPipeline.createPipelineLayout("bloomYPipelineLayout", ["bloomYPass"]);

    AuroraPipeline.createComputePipeline({
      pipelineName: "bloom pipeline",
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "bloomXPipelineLayout"
      ),
      shader: AuroraShader.getSader("bloomShader"),
    });
  }
  private static startBloomPipeline() {
    if (!this.test) return;
    const commandEncoder = Aurora.device.createCommandEncoder();
    const commandPass = commandEncoder.beginComputePass();
    //==========
    commandPass.setPipeline(AuroraPipeline.getPipeline("bloom pipeline"));
    //blur X 1
    AuroraPipeline.getBindsFromLayout("bloomXPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );

    commandPass.dispatchWorkgroups(
      Math.ceil(Aurora.canvas.width / (128 - (this.options.bloomStrength - 1))),
      Math.ceil(Aurora.canvas.height / 4)
    );
    //blur Y 1
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

    //=========

    commandPass.end();

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
        label: "textures",
      },
      data: {
        label: "textures renderer bind group",
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
    this.pipelinesInFrame.push(globalEffectEncoder.finish());
  }
  private static crateLightsPipeline() {
    this.lightsData = new Uint32Array(
      this.options.LightsPerFrame * LIGHT_ATT_PER_SPRITE
    );
    this.lightsDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.lightsData,
      label: "lightsBuffer",
    });
    AuroraPipeline.createVertexBufferLayout("lightsVertexLayout", {
      arrayStride: LIGHT_ATT_PER_SPRITE * Uint32Array.BYTES_PER_ELEMENT,
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
      name: "radialLightsBind",
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
        label: "texture",
      },
      data: {
        label: "textures renderer bind group",
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
    AuroraPipeline.createPipelineLayout("lightPipelineLayout", [
      "radialLightsBind",
      "camera",
    ]);
    AuroraShader.addShader("lightShader", lightShader);
    AuroraPipeline.createVertexBufferLayoutGroup("lightBuffersLayout", [
      "lightsVertexLayout",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup("lightBuffersLayout"),
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout(
        "lightPipelineLayout"
      ),
      pipelineName: "lightsPipeline",
      shader: AuroraShader.getSader("lightShader"),
    });
  }
  private static startLightsPipeline() {
    if (this.numberOfLightsInFrame === 0) return;
    const universalEncoder = Aurora.device.createCommandEncoder();
    const col = 0.2;
    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.lightsTexture.texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0.5, 0.5, 0.5, 1],
        },
      ],
    });

    Aurora.device.queue.writeBuffer(this.lightsDataBuffer, 0, this.lightsData);
    AuroraPipeline.getBindsFromLayout("lightPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("lightsPipeline"));
    commandPass.setVertexBuffer(0, this.lightsDataBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(INDICIES_PER_QUAD, this.numberOfLightsInFrame);
    commandPass.end();
    this.pipelinesInFrame.push(universalEncoder.finish());
  }
}
