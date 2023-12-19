import AuroraBatcher, { TEST } from "../aurora/auroraBatcher";
import Aurora from "../aurora/auroraCore";
import AuroraTexture from "../aurora/auroraTexture";
import char from "../assets/lamp1.png";
import map from "../assets/lamp2.png";
import "../index.css";
import latoData from "../fonts/lato_regular_32.json";
import fontLato from "../assets/lato_regular_32.png";
import RenderFrame from "../debugger/renderStats/renderFrame";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;
const createAurora = async () => {
  await Aurora.initialize(canvas);
  RenderFrame.Initialize();
  await AuroraTexture.createTextureArray({
    label: "userTextureAtlas",
    urls: [char, map],
  });
  await AuroraBatcher.loadFont(fontLato, latoData);

  await AuroraBatcher.createBatcher({
    backgroundColor: [255, 250, 0, 255],
    bloomStrength: 16,
  });
  AuroraBatcher.setScreenShader("grayscale", 0.6);
  AuroraBatcher.setGlobalColorCorrection([0.1, 0.1, 0.1]);

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
        AuroraBatcher.setScreenShader("grayscale", 1);
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
      Aurora.resizeCanvas(window.innerWidth, window.innerHeight);
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
    size: { height: 700, width: 700 },
    tint: new Uint8ClampedArray([255, 255, 255]),
    isTexture: 0,
    textureToUse: 1,
    bloom: 0,
  });
  AuroraBatcher.drawQuad({
    position: { x: 500, y: 100 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 32, width: 32 },
    tint: new Uint8ClampedArray([255, 255, 255]),
    isTexture: 1,
    textureToUse: 0,
    bloom: 1,
  });
  AuroraBatcher.drawQuad({
    position: { x: 700, y: 900 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 602, width: 32 },
    tint: new Uint8ClampedArray([255, 0, 0]),
    isTexture: 0,
    textureToUse: 0,
    bloom: 0,
  });
  AuroraBatcher.drawQuad({
    position: { x: 1000, y: 1200 },
    alpha: 255,
    crop: new Float32Array([
      168 / 512,
      259 / 512,
      168 / 512 + 25 / 512,
      259 / 512 + 26 / 512,
    ]),
    size: { height: 20, width: 20 },
    tint: new Uint8ClampedArray([85, 255, 85]),
    isTexture: 0,
    textureToUse: 0,
    bloom: 1,
  });
  AuroraBatcher.drawText({
    alpha: 255,
    bloom: 0,
    color: new Uint8ClampedArray([80, 80, 250]),
    position: { x: 330, y: 300 },
    text: "Twoja stara,",
    textureToUse: 0,
    weight: 1.5,
  });
  AuroraBatcher.drawText({
    alpha: 255,
    bloom: 0,
    color: new Uint8ClampedArray([80, 80, 250]),
    position: { x: 330, y: 360 },
    text: "jebie śledziem!",
    textureToUse: 0,
    weight: 1.5,
  });
  AuroraBatcher.drawLight({
    position: { x: 1000, y: 1200 },
    size: { width: 600, height: 600 },
    tint: [50, 255, 50],
    intensity: 255,
    type: "radial",
  });
  AuroraBatcher.drawLight({
    position: { x: 500, y: 100 },
    size: { width: 1600, height: 600 },
    tint: [250, 240, 240],
    intensity: 255,
    type: "radial",
  });

  AuroraBatcher.swapToGui();

  AuroraBatcher.drawQuad({
    position: { x: 0.7, y: 0.7 },
    alpha: 85,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 0.2, width: 0.2 },
    tint: new Uint8ClampedArray([255, 0, 0]),
    isTexture: 0,
    textureToUse: 0,
    bloom: 0,
  });
  AuroraBatcher.drawText({
    position: { x: 0.55, y: 0.7 },
    alpha: 255,
    bloom: 0,
    color: new Uint8ClampedArray([80, 80, 250]),
    text: "I AM GUI!",
    textureToUse: 0,
    weight: 1.5,
  });

  const rend = AuroraBatcher.getRendererData;
  const opt = AuroraBatcher.getOptionsData;
  RenderFrame.setGameData({
    lightCurrent: rend.lights,
    quadsCurrent: rend.quads,
    lightsLimit: opt.maxLightsPerSceen,
    quadsLimit: opt.maxQuadPerSceen,
    blooming: opt.bloom,
    bloomStr: opt.bloomStrength,
    camera: opt.customCamera ? "custome" : "built-in",
    colorCorr: rend.colorCorr,
    globalEffect: rend.globalEffect.type,
    globalEffectStr: rend.globalEffect.str,
    lighting: opt.lights,
    computeCalls: AuroraBatcher.getGPUCalls.compute,
    drawCalls: AuroraBatcher.getGPUCalls.render,
  });
  RenderFrame.swapToGPU();
  AuroraBatcher.endBatch();
  RenderFrame.stop();
  requestAnimationFrame(() => draw());
};

createAurora();
