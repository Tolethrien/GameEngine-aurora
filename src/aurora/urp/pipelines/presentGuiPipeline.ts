import AuroraBuffer from "../../auroraBuffer";
import Aurora from "../../auroraCore";
import AuroraPipeline from "../../auroraPipeline";
import AuroraShader from "../../auroraShader";
import AuroraTexture from "../../auroraTexture";
import screenQuad from "../shaders/screenQuad.wgsl?raw";
import Batcher from "../batcher";

export default class PresentGuiPipeline {
  // private static verticesBuffer: GPUBuffer;
  public static createPipeline() {
    // this.verticesBuffer = AuroraBuffer.createBufferMaped({
    //   bufferType: "vertex",
    //   label: "presentGuiVertexQuad",
    //   data: [0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1],
    //   type: "Float32Array",
    // });
    AuroraShader.addShader("presentGuiShader", screenQuad);
    AuroraPipeline.addBindGroup({
      name: "presentGuiBind",
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
            sampler: {},
          },
        ],
        label: "presentGuiBindLayout",
      },
      data: {
        label: "presentGuiBindData",
        entries: [
          {
            binding: 0,
            resource:
              AuroraTexture.getTexture("GUITexture").texture.createView(),
          },
          {
            binding: 1,
            resource: AuroraTexture.getSampler("universal"),
          },
        ],
      },
    });

    AuroraPipeline.createPipelineLayout("presentGuiPipelineLayout", [
      "presentGuiBind",
    ]);
    AuroraPipeline.createRenderPipeline({
      buffers: [],
      pipelineLayout: AuroraPipeline.getPipelineLayout(
        "presentGuiPipelineLayout"
      ),
      pipelineName: "presentGuiPipeline",
      colorTargets: [AuroraPipeline.getColorTargetTemplate("standard")],

      shader: AuroraShader.getSader("presentGuiShader"),
    });
  }
  public static startPipeline() {
    if (Batcher.getRenderData.numberOfQuads.gui === 0) return;
    const globalEffectEncoder = Aurora.device.createCommandEncoder();
    const commandPass = globalEffectEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: Aurora.context.getCurrentTexture().createView(),
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    // commandPass.setVertexBuffer(0, this.verticesBuffer);
    AuroraPipeline.getBindsFromLayout("presentGuiPipelineLayout").forEach(
      (bind, index) => {
        commandPass.setBindGroup(index, bind);
      }
    );
    commandPass.setPipeline(AuroraPipeline.getPipeline("presentGuiPipeline"));
    commandPass.draw(6, 1);
    commandPass.end();
    Batcher.getRenderData.drawCallsInFrame.render++;
    Batcher.getPipelinesInFrame.push(globalEffectEncoder.finish());
  }
}
