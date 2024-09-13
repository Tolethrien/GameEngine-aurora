import AuroraBuffer from "../../auroraBuffer";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import lightsShader from "../shaders/lights.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class LightsPipeline {
  private static lightsDataBuffer: GPUBuffer;
  private static lightsData: Uint32Array;
  private static typesOfLights = {
    radial: 0,
    point: 1,
  };
  public static createPipeline() {
    this.lightsData = new Uint32Array(
      Batcher.getRenderData.limits.lightsPerFrame * Batcher.getStride.lights +
        Batcher.getStride.lights
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
      arrayStride: Batcher.getStride.lights * Uint32Array.BYTES_PER_ELEMENT,
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
            resource: AuroraTexture.getSampler("universal"),
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
      pipelineLayout: AuroraPipeline.getPipelineLayout("lightsPipelineLayout"),
      pipelineName: "lightsPipeline",
      colorTargets: [AuroraPipeline.getColorTargetTemplate("post-process")],

      shader: AuroraShader.getSader("lightsShader"),
    });
  }
  public static startPipeline() {
    const renderData = Batcher.getRenderData;
    //TODO: dodac rozne rodzaje swiatel i zrobic array ich
    //TODO: czy przypadkiem nie jest tak ze wpierw maluje cala teksture a potem nanosze swiatla na pomalowane?
    // co oznacza ze swiatlo samo w sobie sie zaciemnia pomalowaniem?
    if (!renderData.lighting) return;
    const universalEncoder = Aurora.device.createCommandEncoder();

    const commandPass = universalEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture("lightsTexture").texture.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [...renderData.colorCorrection, 1],
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
    commandPass.setIndexBuffer(Batcher.getIndexBuffer, "uint32");
    commandPass.drawIndexed(
      Batcher.getStride.indices,
      1 + renderData.numberOfLights
    );
    commandPass.end();
    renderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(universalEncoder.finish());
  }
  public static get getLightsData() {
    return this.lightsData;
  }
  public static get getLightTypes() {
    return this.typesOfLights;
  }
}
