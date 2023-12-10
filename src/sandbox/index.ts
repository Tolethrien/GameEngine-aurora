import AuroraBatcher from "../aurora/testBatcher";
import Aurora from "../aurora/auroraCore";
import AuroraTexture from "../aurora/auroraTexture";
import char from "../assets/lamp1.png";
import map from "../assets/lamp2.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;
const createAurora = async () => {
  await Aurora.initialize(canvas);
  RenderFrame.Initialize();
  const texture = await AuroraTexture.createTextureArray("spritesAtlases", [
    { name: "char", url: char },
    { name: "map", url: map },
  ]);
  AuroraBatcher.setTextures(texture);
  await AuroraBatcher.createBatcher({
    backgroundColor: [0, 0, 0, 255],
    bloomStrength: 16,
  });
  window.addEventListener("keypress", (e) => {
    if (e.key === "h") {
      AuroraBatcher.test = !AuroraBatcher.test;
      if (AuroraBatcher.test) AuroraBatcher.compositeData[0] = 1;
      if (!AuroraBatcher.test) AuroraBatcher.compositeData[0] = 0;
      console.log("now:", AuroraBatcher.test);
    }
  });
  draw();
};
const draw = () => {
  RenderFrame.start();
  AuroraBatcher.startBatch();
  AuroraBatcher.drawQuad({
    position: { x: 320, y: 300 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 132, width: 100 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([250, 225, 255]),
    bloom: 1,
  });
  AuroraBatcher.drawQuad({
    position: { x: 500, y: 600 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 132, width: 100 },
    textureToUse: 1,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: 0,
  });
  AuroraBatcher.drawLight({
    position: { x: 20, y: 300 },
    size: { width: 6, height: 6 },
    tint: [250, 100, 100],
    intensity: 255,
    type: "radial",
  });
  AuroraBatcher.applyScreenShader("invert", 1);

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
