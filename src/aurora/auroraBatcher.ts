import Aurora from "./auroraCore";
import AuroraPipeline from "./auroraPipeline";
import AuroraShader from "./auroraShader";
import uniShader from "./shaders/universalShader.wgsl?raw";
import { normalizeColor } from "../math/math";
import AuroraTexture, { GPULoadedTexture } from "./auroraTexture";
import AuroraBuffer from "./auroraBuffer";
// import { normalizeColor } from "../utils/utils";
interface SpriteProps {
  position: { x: number; y: number };
  size: { width: number; height: number };
  textureToUse: number;
  crop: Float32Array;
  tint: Uint8ClampedArray;
  alpha: number;
  isTexture: number;
}
type BatcherOptions = typeof OPTIONS_TEMPLATE;
const OPTIONS_TEMPLATE = {
  backgroundColor: [0, 0, 0, 255],
  maxQuadPerBatch: 10000,
};
const MAX_NUMBER_OF_QUADS_PER_BATCH = OPTIONS_TEMPLATE.maxQuadPerBatch;
const VERTEX_ATT_COUNT = 8;
const ADDDATA_ATT_COUNT = 6;
const INDICIES_PER_QUAD = 6;

export default class AuroraBatcher {
  public static numberOfQuadsInBatch = 0;
  private static vertexBuffer: GPUBuffer;
  private static indexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;
  private static bindGroupsData: GPUBindGroup[];
  public static vertices: Float32Array;
  public static addData: Uint32Array;
  private static options: BatcherOptions;
  private static offscreenTexture: GPULoadedTexture;

  public static createBatcher(options?: BatcherOptions) {
    this.options = this.setOptions(options);
    this.createBatcherTextures();
    this.createBuffersTypedArrays();
    this.createBatchBuffers();
    this.createShaders();
    this.createPipelines();
  }
  // public static setBindGroups(bindGroups: BindGroupsData) {}
  public static useBindsFromLayout(layoutName: string) {
    this.bindGroupsData = AuroraPipeline.getBindsFromLayout(layoutName);
  }
  public static startBatch() {
    this.numberOfQuadsInBatch = 0;
  }
  public static endBatch() {
    const encoderOffscreen = Aurora.device.createCommandEncoder();
    const commandPass = encoderOffscreen.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: this.options.backgroundColor,
        },
      ],
    });
    Aurora.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    Aurora.device.queue.writeBuffer(this.addDataBuffer, 0, this.addData);
    // console.log(this.bindGroupsData);
    this.bindGroupsData.forEach((bind, index) => {
      commandPass.setBindGroup(index, bind);
    });
    commandPass.setPipeline(AuroraPipeline.getPipeline("universal pipeline"));
    commandPass.setVertexBuffer(0, this.vertexBuffer);
    commandPass.setVertexBuffer(1, this.addDataBuffer);
    commandPass.setIndexBuffer(this.indexBuffer, "uint32");
    commandPass.drawIndexed(INDICIES_PER_QUAD, this.numberOfQuadsInBatch);
    commandPass.end();

    Aurora.device.queue.submit([encoderOffscreen.finish()]);
  }

  public static drawQuad({
    position,
    size,
    textureToUse,
    crop,
    alpha,
    tint,
    isTexture,
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
    this.numberOfQuadsInBatch++;
  }

  private static createBatchBuffers() {
    this.addDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.addData,
      label: "universal add Data buffer",
    });
    this.vertexBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.vertices,
      label: "universal pipeline vertex buffer",
    });
    this.indexBuffer = AuroraBuffer.createBufferMaped({
      data: [0, 1, 2, 1, 2, 3],
      bufferType: "index",
      type: "Uint32Array",
      label: "batch renderer index buffer",
    });
  }
  private static createBuffersTypedArrays() {
    this.vertices = new Float32Array(
      MAX_NUMBER_OF_QUADS_PER_BATCH * VERTEX_ATT_COUNT
    );
    this.addData = new Uint32Array(
      MAX_NUMBER_OF_QUADS_PER_BATCH * ADDDATA_ATT_COUNT
    );
  }
  private static createPipelines() {
    //TODO: rozkminic liczenie długosci strida ktory ma i floaty i uinty i polaczyc buffery w jeden
    this.getPipelineLayouts();
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup("universalVBLayout"),
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout("universal"),
      pipelineName: "universal pipeline",
      shader: AuroraShader.getSader("universalShader"),
    });
  }
  private static getPipelineLayouts() {
    AuroraPipeline.createVertexBufferLayout("universalVertexBuffer", {
      arrayStride: 8 * Float32Array.BYTES_PER_ELEMENT,
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
    AuroraPipeline.createVertexBufferLayout("universalAddDataBuffer", {
      arrayStride: 6 * Uint32Array.BYTES_PER_ELEMENT,
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
      ],
    });
    AuroraPipeline.createVertexBufferLayoutGroup("universalVBLayout", [
      "universalVertexBuffer",
      "universalAddDataBuffer",
    ]);
  }
  private static createShaders() {
    AuroraShader.addShader("universalShader", uniShader);
    // const postProcessEffectShader = AuroraShader.createShader(
    //   uniShader,
    //   "post processing shader"
    // );
  }
  private static setOptions(options?: BatcherOptions) {
    const template = { ...OPTIONS_TEMPLATE, ...options };
    template.backgroundColor = normalizeColor(template.backgroundColor);
    return template;
  }
  private static createBatcherTextures() {
    this.offscreenTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height
    );
  }
  private static createUniversalPipeline() {
    this.vertices = new Float32Array(
      MAX_NUMBER_OF_QUADS_PER_BATCH * VERTEX_ATT_COUNT
    );
    this.addData = new Uint32Array(
      MAX_NUMBER_OF_QUADS_PER_BATCH * ADDDATA_ATT_COUNT
    );
  }
  private static setUniveralPipeline() {}
}
