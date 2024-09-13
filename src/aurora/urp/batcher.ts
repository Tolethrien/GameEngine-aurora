import { clamp, normalizeColor } from "../../math/math";
import AuroraCamera from "./auroraCamera";
import Aurora from "../auroraCore";
import AuroraTexture, {
  GPUAuroraTexture,
  GeneralTextureProps,
} from "../auroraTexture";
import BloomPipeline from "./pipelines/bloomPipeline";
import CompositePipeline from "./pipelines/compositePipeline";
import LayeredTestPipeline from "./pipelines/layeredTestPipeline";
import LightsPipeline from "./pipelines/lightsPipeline";
import OffscreenPipeline from "./pipelines/offscreenPipeline";
import PresentationPipeline, {
  ScreenEffects,
} from "./pipelines/presentationPipeline";
import TresholdPipeline from "./pipelines/tresholdPipeline";
import AuroraBuffer from "../auroraBuffer";
import AuroraPipeline from "../auroraPipeline";
import GUIPipeline from "./pipelines/guiPipeline";
import { parseTTF } from "./parserTTF/parse";
import { createGlyphLUT } from "./parserTTF/glyphLUT";
import { createGlyphAtlas } from "./parserTTF/glyphAtlas";
import Fonter from "./parserTTF/fonter";
import PresentGuiPipeline from "./pipelines/presentGuiPipeline";
import Vec2D from "../../math/vec2D";
import radialL from "./assets/radial.png";
import roboto from "./assets/roboto.ttf";
import dummyTexture from "./assets/dummy.png";

interface RenderData {
  numberOfQuads: {
    total: number;
    game: number;
    gui: number;
  };
  numberOfLights: number;
  limits: {
    quadsPerFrame: number;
    lightsPerFrame: number;
    guiPerFrame: number;
  };
  drawCallsInFrame: {
    render: number;
    compute: number;
  };
  colorCorrection: number[];
  backgroundColor: number[];
  customCamera: boolean;
  bloom: { active: boolean; str: number };
  lighting: boolean;
  screenShader: { type: ScreenEffects; str: number };
}
interface BatcherOptions {
  backgroundColor: number[];
  maxQuadPerSceen: number;
  maxLightsPerSceen: number;
  maxGuiPerSceen: number;
  customCamera: boolean;
  bloom: { active: boolean; str: number };
  lighting: boolean;
  loadTextures: { name: string; url: string }[];
  loadFonts: { name: string; font: string }[];
}
interface Stride {
  vertices: number;
  gameAddData: number;
  guiAddData: number;
  indices: number;
  lights: number;
}

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
export default class Batcher {
  private static renderData: RenderData = {
    drawCallsInFrame: { compute: 0, render: 0 },
    limits: { lightsPerFrame: 100, quadsPerFrame: 10000, guiPerFrame: 1000 },
    numberOfLights: 0,
    numberOfQuads: { game: 0, gui: 0, total: 0 },
    backgroundColor: [0, 0, 0, 255],
    colorCorrection: [255, 255, 255],
    customCamera: false,
    bloom: { active: true, str: 16 },
    lighting: true,
    screenShader: { type: "none", str: 0 },
  };
  private static stride: Stride = {
    vertices: 8,
    gameAddData: 8,
    guiAddData: 8,
    indices: 6,
    lights: 9,
  };

  private static pipelinesInFrame: GPUCommandBuffer[] = [];
  private static testMode = false;

  private static projectionBuffer: GPUBuffer;
  private static customcameraMatrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  private static indexBuffer: GPUBuffer;
  public static async createBatcher(options?: Partial<BatcherOptions>) {
    this.indexBuffer = AuroraBuffer.createMapedBuffer({
      data: [0, 1, 2, 1, 2, 3],
      bufferType: "index",
      dataType: "Uint32Array",
      label: "offscreenIndexBuffer",
    });
    this.setOptions(options);
    await this.createBatcherTextures();
    await this.createFontsTexture(options?.loadFonts);
    await this.createTextureBatch(options?.loadTextures);
    this.createCamera();
    OffscreenPipeline.createPipeline();
    TresholdPipeline.createPipeline();
    BloomPipeline.createPipeline();
    LightsPipeline.createPipeline();
    CompositePipeline.createPipeline();
    GUIPipeline.createPipeline();
    if (this.testMode) LayeredTestPipeline.createPipeline();
    else {
      PresentationPipeline.createPipeline();
      PresentGuiPipeline.createPipeline();
    }
  }
  public static get getRenderData() {
    return this.renderData;
  }
  public static get getStride() {
    return this.stride;
  }
  public static get getPipelinesInFrame() {
    return this.pipelinesInFrame;
  }
  public static get getIndexBuffer() {
    return this.indexBuffer;
  }

  private static setOptions(options?: Partial<BatcherOptions>) {
    //TODO: zmienic to na nie takie łopatologiczne
    if (!options) return;
    if (options.backgroundColor)
      this.renderData.backgroundColor = normalizeColor(options.backgroundColor);
    if (options.customCamera) this.renderData.customCamera = true;
    else AuroraCamera.initialize();
    if (options.maxGuiPerSceen)
      this.renderData.limits.guiPerFrame = options.maxGuiPerSceen;
    if (options.bloom) this.renderData.bloom = options.bloom;
    if (options.lighting) this.renderData.lighting = true;
    if (options.maxQuadPerSceen)
      this.renderData.limits.quadsPerFrame = options.maxQuadPerSceen;
    if (options.maxLightsPerSceen)
      this.renderData.limits.lightsPerFrame = options.maxLightsPerSceen;
  }
  private static async createBatcherTextures() {
    AuroraTexture.createSampler("universal");
    AuroraTexture.createSampler("linear", {
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      mipmapFilter: "linear",
    });

    await AuroraTexture.createTextureArray({
      label: "lightsList",
      textures: [
        { name: "radial", url: radialL },
        { name: "point", url: radialL },
      ],
    });

    AuroraTexture.createTextureEmpty({
      label: "offscreenTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
      label: "offscreenTextureFloat",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
      format: "rgba16float",
    });
    AuroraTexture.createTextureEmpty({
      label: "treshholdTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
      label: "lightsTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
      label: "GUITexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
      label: "bloomPassOneTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
      label: "bloomPassTwoTexture",
      size: {
        width: Aurora.canvas.width,
        height: Aurora.canvas.height,
      },
    });
    AuroraTexture.createTextureEmpty({
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
      typedArr: this.renderData.customCamera
        ? this.customcameraMatrix
        : AuroraCamera.getProjectionViewMatrix.getMatrix,
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
  private static async createFontsTexture(fonts?: BatcherOptions["loadFonts"]) {
    //TODO: for now font will be generated on game start, later, will be genrated on final game export and stored to save a loot of compute time

    const atlases: { name: string; bitmap: ImageBitmap }[] = [];
    const fontFile = await fetch(roboto).then((result) => result.arrayBuffer());
    const ttf = parseTTF(fontFile);
    const lookups = createGlyphLUT(ttf);
    const fontAtlas = await createGlyphAtlas(lookups, fontFile, {
      useSDF: true,
    });
    Fonter.addFont({
      fontName: "roboto",
      LUT: lookups,
      textureIndex: atlases.length,
      atlasSize: Vec2D.Create([fontAtlas.width, fontAtlas.height]),
    });
    atlases.push({ name: "roboto", bitmap: fontAtlas });
    if (fonts) {
      if (fonts.length == 0)
        throw new Error(
          "Batcher Error: loadFont array is empty, add fonts or remove it from options"
        );
      for (const { font, name } of fonts) {
        const fontFile = await fetch(font).then((result) =>
          result.arrayBuffer()
        );
        const ttf = parseTTF(fontFile);
        const lookups = createGlyphLUT(ttf);
        const fontAtlas = await createGlyphAtlas(lookups, fontFile, {
          useSDF: true,
        });
        Fonter.addFont({
          fontName: name,
          LUT: lookups,
          textureIndex: atlases.length,
          atlasSize: Vec2D.Create([fontAtlas.width, fontAtlas.height]),
        });
        atlases.push({ name, bitmap: fontAtlas });
      }
    } else {
      await fetch(dummyTexture)
        .then((response) => response.blob())
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => atlases.push({ name: "roboto", bitmap: bitmap }));
    }
    const { meta } = AuroraTexture.createTextureArrayFromBitmap({
      label: "batcherFonts",
      bitmaps: atlases,
    });
    this.recalculateUVS(meta);
  }

  private static async createTextureBatch(
    textures?: BatcherOptions["loadTextures"]
  ) {
    let texturesToUse = textures;
    if (texturesToUse) {
      texturesToUse.unshift({ name: "batcherColor", url: dummyTexture });
    } else {
      texturesToUse = [
        { name: "batcherColor", url: dummyTexture },
        { name: "batcherColor", url: dummyTexture },
      ];
    }
    await AuroraTexture.createTextureArray({
      textures: texturesToUse,
      label: "TextureBatchGame",
    } as GeneralTextureProps & {
      textures: BatcherOptions["loadTextures"];
    });
  }
  public static startBatch() {
    this.renderData.numberOfQuads = {
      game: 0,
      gui: 0,
      total: 0,
    };
    this.renderData.numberOfLights = 0;
    this.pipelinesInFrame = [];
    !this.renderData.customCamera && AuroraCamera.update();
  }
  public static endBatch() {
    this.renderData.drawCallsInFrame = { compute: 0, render: 0 };
    Aurora.device.queue.writeBuffer(
      this.projectionBuffer,
      0,
      this.renderData.customCamera
        ? this.customcameraMatrix
        : AuroraCamera.getProjectionViewMatrix.getMatrix
    );
    OffscreenPipeline.startPipeline();
    TresholdPipeline.startPipeline();
    BloomPipeline.startPipeline();
    LightsPipeline.startPipeline();
    CompositePipeline.startPipeline();
    GUIPipeline.startPipeline();
    if (this.testMode) LayeredTestPipeline.startPipeline();
    else {
      PresentationPipeline.startPipeline();
      PresentGuiPipeline.startPipeline();
    }
    Aurora.device.queue.submit(this.pipelinesInFrame);
  }
  public static setScreenShader(effect: ScreenEffects, intesity?: number) {
    if (this.testMode) {
      const data = LayeredTestPipeline.getGlobalEffectData;
      const effectList = LayeredTestPipeline.getEffectList;
      data[0] = effectList[effect];
      this.renderData.screenShader.type = effect;
      if (intesity) {
        data[1] = clamp(intesity, 0, 1);
        this.renderData.screenShader.str = intesity;
      }
    } else {
      const data = PresentationPipeline.getGlobalEffectData;
      const effectList = PresentationPipeline.getEffectList;
      data[0] = effectList[effect];
      this.renderData.screenShader.type = effect;
      if (intesity) {
        data[1] = clamp(intesity, 0, 1);
        this.renderData.screenShader.str = intesity;
      }
    }
  }
  public static setGlobalColorCorrection(color: [number, number, number]) {
    this.renderData.colorCorrection = color;
  }
  public static setBloom(active: boolean, strength?: number) {
    this.renderData.bloom.active = active;
    strength && (this.renderData.bloom.str = clamp(strength, 0, 50));
    CompositePipeline.getCompositeData[1] = active ? 1 : 0;
  }
  public static setLights(active: boolean) {
    this.renderData.lighting = active;
    CompositePipeline.getCompositeData[0] = active ? 1 : 0;
  }
  public static setCameraBuffer(matrix: Float32Array) {
    this.customcameraMatrix = matrix;
  }

  private static recalculateUVS({ width }: GPUAuroraTexture["meta"]) {
    const fonts = Fonter.getAlaFontsMeta;
    fonts.forEach(({ LUT, atlasSize }) => {
      if (width === atlasSize.x) return;
      const siezRatio = width / atlasSize.x;
      LUT.uvs = new Map(
        Array.from(LUT.uvs).map((uvs) => [
          uvs[0],
          (uvs[1] as Vec4DType).div(siezRatio),
        ])
      );
    });
  }
}
