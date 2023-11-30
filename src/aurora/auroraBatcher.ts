import Aurora from "./auroraCore";
import AuroraPipeline from "./auroraPipeline";
import AuroraShader from "./auroraShader";
import uniShader from "./shaders/universalShader.wgsl?raw";
import testShader from "./shaders/testShader.wgsl?raw";
import { normalizeColor } from "../math/math";
import AuroraTexture, { GPULoadedTexture } from "./auroraTexture";
import AuroraBuffer from "./auroraBuffer";
import AuroraCamera from "./auroraCamera";
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
type TextureAtlas = { texture: GPUTexture; sampler: GPUSampler };
type BatcherOptions = Partial<typeof OPTIONS_TEMPLATE>;
const OPTIONS_TEMPLATE = {
  backgroundColor: [0, 0, 0, 255],
  maxQuadPerBatch: 10000,
  customCamera: false,
};
const VERTEX_ATT_COUNT = 8;
const ADDDATA_ATT_COUNT = 6;
const INDICIES_PER_QUAD = 6;

export default class AuroraBatcher {
  public static numberOfQuadsInBatch = 0;
  public static maxNumberOfQuads = OPTIONS_TEMPLATE.maxQuadPerBatch;

  private static vertexBuffer: GPUBuffer;
  private static indexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;
  private static projectionBuffer: GPUBuffer;
  public static vertices: Float32Array;
  public static addData: Uint32Array;
  public static projection: Float32Array;
  private static options: BatcherOptions;
  private static offscreenTexture: GPULoadedTexture;
  private static camera: AuroraCamera | undefined;
  private static customcameraMatrix: Float32Array = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  private static textureAtlas: TextureAtlas & { name: string };

  public static createBatcher(options?: BatcherOptions) {
    this.options = this.setOptions(options);
    this.createBatcherTextures();
    this.createUniversalPipeline();
    this.createTestPipeline();
  }

  public static async setTextures(texture: TextureAtlas) {
    this.textureAtlas = { ...texture, name: "textures" };
  }
  public static startBatch() {
    this.numberOfQuadsInBatch = 0;
  }
  public static endBatch() {
    !this.options.customCamera && this.camera.update();
    const universalEncoder = this.startUniversalPipeline();
    const test = this.startTestPipeline();
    Aurora.device.queue.submit([universalEncoder.finish(), test.finish()]);
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

  private static setOptions(options?: BatcherOptions) {
    const template = { ...OPTIONS_TEMPLATE, ...options };
    template.backgroundColor = normalizeColor(template.backgroundColor);
    !template.customCamera && (this.camera = new AuroraCamera());

    return template;
  }
  private static createBatcherTextures() {
    this.offscreenTexture = AuroraTexture.createEmptyTexture(
      Aurora.canvas.width,
      Aurora.canvas.height
    );
  }
  private static createUniversalPipeline() {
    this.vertices = new Float32Array(this.maxNumberOfQuads * VERTEX_ATT_COUNT);
    this.addData = new Uint32Array(this.maxNumberOfQuads * ADDDATA_ATT_COUNT);
    AuroraPipeline.createVertexBufferLayout("universalVertexBufferLayout", {
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
    AuroraPipeline.createVertexBufferLayout("universalAddDataBufferLayout", {
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
    AuroraPipeline.createRenderPipelineLayout("universal", [
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
    });
  }

  private static startUniversalPipeline() {
    const universalEncoder = Aurora.device.createCommandEncoder();
    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.offscreenTexture.texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0.5, 0.5, 0.5, 1],
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
    return universalEncoder;
  }
  private static createTestPipeline() {
    AuroraShader.addShader("testShader", testShader);
    AuroraPipeline.addBindGroup({
      name: "empty",
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
            resource: this.offscreenTexture.sampler,
          },
          {
            binding: 1,
            resource: this.offscreenTexture.texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createRenderPipelineLayout("test", ["empty"]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getRenderPipelineLayout("test"),
      pipelineName: "test pipeline",
      shader: AuroraShader.getSader("testShader"),
    });
  }
  private static startTestPipeline() {
    const testEncoder = Aurora.device.createCommandEncoder();
    const commandPass = testEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    AuroraPipeline.getBindsFromLayout("test").forEach((bind, index) => {
      commandPass.setBindGroup(index, bind);
    });

    commandPass.setPipeline(AuroraPipeline.getPipeline("test pipeline"));
    commandPass.draw(6, 1);
    commandPass.end();
    return testEncoder;
  }
}
