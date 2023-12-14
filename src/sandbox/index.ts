import AuroraBatcher from "../aurora/auroraBatcher";
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
  await AuroraTexture.createTextureArray({
    label: "userTextureAtlas",
    urls: [char, map],
  });

  await AuroraBatcher.createBatcher({
    backgroundColor: [255, 0, 0, 255],
    bloomStrength: 16,
  });
  AuroraBatcher.setScreenShader("invert", 1);
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
        AuroraBatcher.setScreenShader("vignette", 1);
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
    isTexture: 1,
    size: { height: 1300, width: 1300 },
    textureToUse: 1,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: 0,
  });
  AuroraBatcher.drawQuad({
    position: { x: 1000, y: 1200 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 32, width: 32 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: 1,
  });
  AuroraBatcher.drawQuad({
    position: { x: 1500, y: 1200 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    isTexture: 1,
    size: { height: 100, width: 100 },
    textureToUse: 0,
    tint: new Uint8ClampedArray([255, 255, 255]),
    bloom: 1,
  });

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
