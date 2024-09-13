import AuroraBuffer from "../../auroraBuffer";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import offscreenShader from "../shaders/universalShader.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class OffscreenPipeline {
  private static vertices: Float32Array;
  private static addData: Uint32Array;
  private static vertexBuffer: GPUBuffer;
  private static addDataBuffer: GPUBuffer;

  public static createPipeline(): void {
    this.vertices = new Float32Array(
      Batcher.getRenderData.limits.quadsPerFrame * Batcher.getStride.vertices
    );
    this.addData = new Uint32Array(
      Batcher.getRenderData.limits.quadsPerFrame * Batcher.getStride.gameAddData
    );
    AuroraPipeline.createVertexBufferLayout("offscreenVertexBufferLayout", {
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
    AuroraPipeline.createVertexBufferLayout("offscreenaddDataBufferLayout", {
      arrayStride:
        Batcher.getStride.gameAddData * Uint32Array.BYTES_PER_ELEMENT,
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
      label: "offscreenaddDataBuffer",
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
    AuroraPipeline.createPipelineLayout("offscreenPipelineLayout", [
      "userAssetsBind",
      "textBind",
      "cameraBind",
    ]);
    AuroraShader.addShader("offscreenShader", offscreenShader);
    AuroraPipeline.createVertexBufferLayoutGroup(
      "offscreenBuffersGroupLayout",
      ["offscreenVertexBufferLayout", "offscreenaddDataBufferLayout"]
    );
    AuroraPipeline.createRenderPipeline({
      buffers: AuroraPipeline.getVertexBufferLayoutGroup(
        "offscreenBuffersGroupLayout"
      ),
      pipelineLayout: AuroraPipeline.getPipelineLayout(
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
  public static startPipeline(): void {
    const renderData = Batcher.getRenderData;
    const universalEncoder = Aurora.device.createCommandEncoder();
    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture(
            "offscreenTexture"
          ).texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: Batcher.getRenderData.backgroundColor,
        },
        {
          view: AuroraTexture.getTexture(
            "offscreenTextureFloat"
          ).texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: Batcher.getRenderData.backgroundColor,
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
    commandPass.setIndexBuffer(Batcher.getIndexBuffer, "uint32");
    commandPass.drawIndexed(
      Batcher.getStride.indices,
      renderData.numberOfQuads.game
    );
    commandPass.end();
    renderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(universalEncoder.finish());
  }
  static get getVertices() {
    return this.vertices;
  }
  static get getAddData() {
    return this.addData;
  }
}
