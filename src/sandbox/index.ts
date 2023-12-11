import AuroraBatcher from "../aurora/testBatcher";
import Aurora from "../aurora/auroraCore";
import AuroraTexture from "../aurora/auroraTexture";
import char from "../assets/lamp1.png";
import map from "../assets/lamp2.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;
let red = 1;
let lon = 0;
let tete = false;
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
  AuroraBatcher.setScreenShader("invert", 1);

  window.addEventListener("keypress", (e) => {
    if (e.key === "h") {
      if (AuroraBatcher.getOptionsData.lights) {
        AuroraBatcher.setLights(false);
      } else {
        AuroraBatcher.setLights(true);
      }
    }
    if (e.key === "g") {
      if (AuroraBatcher.globalEffect[0] === 0) {
        AuroraBatcher.setScreenShader("invert", 1);
      } else {
        AuroraBatcher.setScreenShader("none");
      }
    }
    if (e.key === "j") {
      if (AuroraBatcher.getOptionsData.bloom) {
        AuroraBatcher.setBloom(false);
      } else {
        AuroraBatcher.setBloom(true, 16);
      }
    }
    if (e.key === "b") {
      tete = true;
    }
  });
  draw();
};
const draw = () => {
  RenderFrame.start();
  AuroraBatcher.startBatch();
  AuroraBatcher.drawQuad({
    position: { x: 1000, y: 1000 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 1000, width: 1000 },
    textureToUse: 1,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: 0,
  });
  AuroraBatcher.drawQuad({
    position: { x: 1000, y: 1200 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 132, width: 100 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: lon,
  });
  AuroraBatcher.drawQuad({
    position: { x: 1500, y: 1200 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 132, width: 100 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: lon,
  });

  AuroraBatcher.setGlobalLight([red + 0.3, red + 0.3, red]);
  if (tete) red -= 0.001;
  if (red < 0.25) lon = 1;
  if (lon === 1) {
    AuroraBatcher.drawLight({
      position: { x: 1000, y: 1200 },
      size: { width: 600, height: 600 },
      tint: [50, 255, 50],
      intensity: 255,
      type: "radial",
    });
    AuroraBatcher.drawLight({
      position: { x: 1500, y: 1200 },
      size: { width: 600, height: 600 },
      tint: [50, 50, 255],
      intensity: 255,
      type: "radial",
    });
  }

  RenderFrame.setQuadCount(
    AuroraBatcher.numberOfQuadsInBatch,
    AuroraBatcher.getOptionsData.maxQuadPerSceen
  );
  RenderFrame.swapToGPU();
  AuroraBatcher.endBatch();
  RenderFrame.stop();
  requestAnimationFrame(() => draw());
};

createAurora();
