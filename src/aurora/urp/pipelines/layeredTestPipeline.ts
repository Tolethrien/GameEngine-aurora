import AuroraBuffer from "../../auroraBuffer";
import Aurora from "../../auroraCore";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import layeredShader from "../shaders/layered.wgsl?raw";
import Batcher from "../batcher";
export type ScreenEffects = keyof typeof LayeredTestPipeline.getEffectList;
export default class LayeredTestPipeline {
  private static globalEffectBuffer: GPUBuffer;
  private static globalEffect: Float32Array;
  private static avalibleScreenEffects = {
    none: 0,
    grayscale: 1,
    sepia: 2,
    invert: 3,
    chromaticAbber: 4,
    vignette: 5,
    noice: 6,
  };
  public static createPipeline() {
    this.globalEffect = new Float32Array([0, 0]);

    this.globalEffectBuffer = AuroraBuffer.createDynamicBuffer({
      bufferType: "uniform",
      label: "globalEffectBuffer",
      typedArr: this.globalEffect,
    });
    AuroraShader.addShader("layeredTestShader", layeredShader);
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
        ],
        label: "compositionTextureBindLayout",
      },
      data: {
        label: "compositionTextureBindData",
        entries: [
          {
            binding: 0,
            resource:
              AuroraTexture.getTexture("offscreenTexture").texture.createView(),
          },
          {
            binding: 1,
            resource: AuroraTexture.getTexture(
              "offscreenTextureFloat"
            ).texture.createView(),
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
          {
            binding: 4,
            resource:
              AuroraTexture.getTexture("compositeTexture").texture.createView(),
          },
          {
            binding: 5,
            resource:
              AuroraTexture.getTexture("GUITexture").texture.createView(),
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
            resource: AuroraTexture.getSampler("universal"),
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
      pipelineLayout: AuroraPipeline.getPipelineLayout("presentPipelineLayout"),
      pipelineName: "presentPipeline",

      shader: AuroraShader.getSader("layeredTestShader"),
    });
  }
  public static startPipeline() {
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
    Batcher.getRenderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(globalEffectEncoder.finish());
  }
  public static get getGlobalEffectData() {
    return this.globalEffect;
  }
  public static get getEffectList() {
    return this.avalibleScreenEffects;
  }
}
