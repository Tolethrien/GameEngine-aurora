import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import tresholdShader from "../shaders/treshold.wgsl?raw";
import Aurora from "../../auroraCore";
import Batcher from "../batcher";

export default class TresholdPipeline {
  public static createPipeline() {
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
        label: "tresholdTextureBindLayout",
      },
      data: {
        label: "tresholdTextureBindData",
        entries: [
          {
            binding: 0,
            resource: AuroraTexture.getSampler("universal"),
          },
          {
            binding: 1,
            resource: AuroraTexture.getTexture(
              "offscreenTextureFloat"
            ).texture.createView(),
          },
        ],
      },
    });

    AuroraPipeline.createPipelineLayout("tresholdPipelineLayout", [
      "tresholdTextureBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getPipelineLayout(
        "tresholdPipelineLayout"
      ),
      pipelineName: "tresholdPipeline",
      shader: AuroraShader.getSader("tresholdShader"),
    });
  }
  public static startPipeline() {
    if (!Batcher.getRenderData.bloom.active) return;
    const globalEffectEncoder = Aurora.device.createCommandEncoder();
    const commandPass = globalEffectEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: AuroraTexture.getTexture(
            "treshholdTexture"
          ).texture.createView(),

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
    Batcher.getRenderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(globalEffectEncoder.finish());
  }
}
