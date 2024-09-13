import AuroraBuffer from "../../auroraBuffer";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import blurShader from "../shaders/blur.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class BloomPipeline {
  private static bloomXBuffer: GPUBuffer;
  private static bloomYBuffer: GPUBuffer;
  public static createPipeline() {
    const bloomStr = Batcher.getRenderData.bloom.str;
    this.bloomXBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "bloomXBuffer",
      typedArr: new Uint32Array([0, bloomStr]),
    });
    this.bloomYBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "bloomYBuffer",
      typedArr: new Uint32Array([1, bloomStr]),
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
          { binding: 0, resource: AuroraTexture.getSampler("linear") },
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
          { binding: 0, resource: AuroraTexture.getSampler("linear") },
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
      pipelineLayout: AuroraPipeline.getPipelineLayout("bloomXPipelineLayout"),
      shader: AuroraShader.getSader("bloomShader"),
    });
  }
  public static startPipeline() {
    const bloomStr = Batcher.getRenderData.bloom.str;
    const renderData = Batcher.getRenderData;
    if (!Batcher.getRenderData.bloom.active) return;
    Aurora.device.queue.writeBuffer(
      this.bloomXBuffer,
      0,
      new Uint32Array([0, bloomStr])
    );
    Aurora.device.queue.writeBuffer(
      this.bloomYBuffer,
      0,
      new Uint32Array([1, bloomStr])
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
      Math.ceil(Aurora.canvas.width / (128 - (bloomStr - 1))),
      Math.ceil(Aurora.canvas.height / 4)
    );
    AuroraPipeline.getBindsFromLayout("bloomYPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.dispatchWorkgroups(
      Math.ceil(Aurora.canvas.height / (128 - (bloomStr - 1))),
      Math.ceil(Aurora.canvas.width / 4)
    );
    commandPass.end();
    renderData.drawCallsInFrame.compute += 2;
    Batcher.getPipelinesInFrame.push(commandEncoder.finish());
  }
}
