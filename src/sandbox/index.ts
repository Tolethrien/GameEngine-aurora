import AuroraBatcher from "../aurora/auroraBatcher";
import Aurora from "../aurora/auroraCore";
import AuroraTexture from "../aurora/auroraTexture";
import char from "../assets/char.png";
import map from "../assets/tilemap3.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;

const createAurora = async () => {
  await Aurora.initialize(canvas);
  RenderFrame.Initialize();
  const texture = await AuroraTexture.createTextureArray([
    { name: "char", url: char },
    { name: "map", url: map },
  ]);
  AuroraBatcher.setTextures(texture);
  AuroraBatcher.createBatcher();
  draw();
};
const draw = () => {
  RenderFrame.start();
  AuroraBatcher.startBatch();
  AuroraBatcher.drawQuad({
    position: { x: 100, y: 100 },
    alpha: 255,
    crop: new Float32Array([0, 0, 32 / 1280, 32 / 832]),
    isTexture: 1,
    size: { height: 132, width: 132 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 5, 5]),
  });

  RenderFrame.setQuadCount(
    AuroraBatcher.numberOfQuadsInBatch,
    AuroraBatcher.maxNumberOfQuads
  );
  RenderFrame.swapToGPU();
  AuroraBatcher.endBatch();
  RenderFrame.stop();
  requestAnimationFrame(() => draw());
};

createAurora();
