import AuroraBuffer from "../../auroraBuffer";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import compositionShader from "../shaders/compositionShader.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class CompositePipeline {
  private static compositeDataBuffer: GPUBuffer;
  private static compositeData: Uint32Array;

  public static createPipeline() {
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
            resource: AuroraTexture.getSampler("universal"),
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
      pipelineLayout: AuroraPipeline.getPipelineLayout(
        "compositionPipelineLayout"
      ),
      pipelineName: "compositionPipeline",
      colorTargets: [AuroraPipeline.getColorTargetTemplate("post-process")],
      shader: AuroraShader.getSader("compositionShader"),
    });
  }
  public static startPipeline() {
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
    Batcher.getRenderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(compositionEncoder.finish());
  }
  public static get getCompositeData() {
    return this.compositeData;
  }
}
