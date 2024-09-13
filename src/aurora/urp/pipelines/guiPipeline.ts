import AuroraBuffer from "../../auroraBuffer";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import GUIShader from "../shaders/gui.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class GUIPipeline {
  private static vertices: Float32Array;
  private static addData: Uint32Array;
  private static vertexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;

  public static createPipeline(): void {
    this.vertices = new Float32Array(
      Batcher.getRenderData.limits.guiPerFrame * Batcher.getStride.vertices
    );
    this.addData = new Uint32Array(
      Batcher.getRenderData.limits.guiPerFrame * Batcher.getStride.guiAddData
    );
    AuroraPipeline.createVertexBufferLayout("GUIVertexBufferLayout", {
      arrayStride: Batcher.getStride.vertices * Float32Array.BYTES_PER_ELEMENT,
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
    AuroraPipeline.createVertexBufferLayout("GUIaddDataBufferLayout", {
      arrayStride: Batcher.getStride.guiAddData * Uint32Array.BYTES_PER_ELEMENT,
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
          shaderLocation: 5, // isTextureOrColor (or if text) Size, see vertex shader
        },
        {
          format: "uint32",
          offset: 6 * Uint32Array.BYTES_PER_ELEMENT,
          shaderLocation: 6, // isText, see vertex shader
        },
      ],
    });
    this.vertexBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.vertices,
      label: "GUIVertexBuffer",
    });
    this.addDataBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "vertex",
      typedArr: this.addData,
      label: "GUIddDataBuffer",
    });

    AuroraPipeline.addBindGroup({
      name: "GUIAssetsBind",
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
        label: "GUIAssetsBindLayout",
      },
      data: {
        label: "GUIAssetsBindData",
        entries: [
          {
            binding: 0,
            resource: AuroraTexture.getSampler("universal"),
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("TextureBatchGame").texture.createView(),
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
            resource: AuroraTexture.getSampler("linear"),
          },
          {
            binding: 1,
            resource:
              AuroraTexture.getTexture("batcherFonts").texture.createView(),
          },
        ],
      },
    });
    AuroraPipeline.createPipelineLayout("GUIPipelineLayout", [
      "GUIAssetsBind",
      "textBind",
    ]);
    AuroraShader.addShader("GUIShader", GUIShader);
    AuroraPipeline.createVertexBufferLayoutGroup("GUIBuffersGroupLayout", [
      "GUIVertexBufferLayout",
      "GUIaddDataBufferLayout",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup(
        "GUIBuffersGroupLayout"
      ),
      pipelineLayout: AuroraPipeline.getPipelineLayout("GUIPipelineLayout"),
      pipelineName: "GUIPipeline",
      shader: AuroraShader.getSader("GUIShader"),
    });
  }
  public static startPipeline(): void {
    const renderData = Batcher.getRenderData;
    if (renderData.numberOfQuads.gui === 0) return;
    const GUIEncoder = Aurora.device.createCommandEncoder();
    const commandPass = GUIEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture("GUITexture").texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [0, 0, 0, 0],
        },
      ],
    });

    Aurora.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices, 0);
    Aurora.device.queue.writeBuffer(this.addDataBuffer, 0, this.addData, 0);
    AuroraPipeline.getBindsFromLayout("GUIPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("GUIPipeline"));
    commandPass.setVertexBuffer(0, this.vertexBuffer);
    commandPass.setVertexBuffer(1, this.addDataBuffer);
    commandPass.setIndexBuffer(Batcher.getIndexBuffer, "uint32");
    commandPass.drawIndexed(
      Batcher.getStride.indices,
      renderData.numberOfQuads.gui
    );
    commandPass.end();
    renderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(GUIEncoder.finish());
  }
  static get getVertices() {
    return this.vertices;
  }
  static get getAddData() {
    return this.addData;
  }
}
