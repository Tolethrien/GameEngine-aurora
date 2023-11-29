import AuroraBatcher from "../aurora/auroraBatcher";
// import AuroraBindGroup from "../aurora/auroraBindGroup";
import AuroraBuffer from "../aurora/auroraBuffer";
import AuroraCamera from "../aurora/auroraCamera";
import Aurora from "../aurora/auroraCore";
import AuroraTexture from "../aurora/auroraTexture";
import char from "../assets/char.png";
import map from "../assets/tilemap3.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
import AuroraPipeline from "../aurora/auroraPipeline";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;
/**
 * plan: swiatlo musi miec:
 *    blobalne swiatło
 *    miejscowe światło
 *    bloom
 *
 * universal shader i pipeline
 *  compute shader dla gainsow wydajnosci
 *
 * universal shader module, gdzie bedziesz mogl wybierac kilka efektow
 * LUT
 *
 */
let projectionUniform: GPUBuffer;
let camera: AuroraCamera;
const createAurora = async () => {
  await Aurora.initialize(canvas);
  RenderFrame.Initialize();
  camera = new AuroraCamera();
  await createBinds();
  AuroraBatcher.createBatcher();
  draw();
};
const draw = () => {
  RenderFrame.start();
  camera.update();
  AuroraBatcher.startBatch();
  Aurora.device.queue.writeBuffer(
    projectionUniform,
    0,
    camera.projectionViewMatrix.getMatrix
  );

  AuroraBatcher.useBindsFromLayout("universal");
  AuroraBatcher.drawQuad({
    position: { x: 200, y: 200 },
    alpha: 255,
    crop: new Float32Array([0, 0, 32 / 1280, 32 / 832]),
    isTexture: 1,
    size: { height: 32, width: 32 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
  });

  RenderFrame.setQuadCount(AuroraBatcher.numberOfQuadsInBatch);
  RenderFrame.swapToGPU();
  AuroraBatcher.endBatch();
  RenderFrame.stop();
  requestAnimationFrame(() => draw());
};
const createBinds = async () => {
  const texture = await AuroraTexture.createTextureArray([
    { name: "char", url: char },
    { name: "map", url: map },
  ]);
  projectionUniform = AuroraBuffer.createDynamicBuffer({
    bufferType: "uniform",
    typedArr: camera.projectionViewMatrix.getMatrix,
    label: "cameraBuffer",
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
      entries: [{ binding: 0, resource: { buffer: projectionUniform } }],
    },
  });

  AuroraPipeline.addBindGroup({
    name: "textures",
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
          resource: texture.sampler,
        },
        {
          binding: 1,
          resource: texture.texture.createView(),
        },
      ],
    },
  });
  AuroraPipeline.createRenderPipelineLayout("universal", [
    "textures",
    "camera",
  ]);
};
createAurora();
