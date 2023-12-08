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
  const texture = await AuroraTexture.createTextureArray("spritesAtlases", [
    { name: "char", url: char },
    { name: "map", url: map },
  ]);
  AuroraBatcher.setTextures(texture);
  AuroraBatcher.createBatcher({
    backgroundColor: [0, 0, 0, 255],
    bloomStrength: 50,
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
    position: { x: 120, y: 100 },
    alpha: 255,
    crop: new Float32Array([0, 0, 32 / 1280, 32 / 832]),
    isTexture: 1,
    size: { height: 132, width: 132 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
    additionalData: {
      bloom: 1,
    },
  });
  AuroraBatcher.drawQuad({
    position: { x: 400, y: 100 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 132, width: 132 },
    textureToUse: 1,
    tint: new Uint8ClampedArray([255, 255, 255]),
    additionalData: {
      bloom: 0,
    },
  });
  // AuroraBatcher.applyScreenShader("vignette", 1);

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
