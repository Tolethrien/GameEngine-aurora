import AuroraBatcher from "../aurora/urp/batcher";
import Aurora from "../aurora/auroraCore";
import char from "../assets/lamp1.png";
import "../index.css";
import RenderFrame from "../debugger/renderStats/renderFrame";
import Draw from "../aurora/urp/draw";
const canvas = document.getElementById("gameEngine") as HTMLCanvasElement;
const createAurora = async () => {
  await Aurora.initialize(canvas);
  RenderFrame.Initialize();

  await AuroraBatcher.createBatcher({
    backgroundColor: [0, 0, 0, 255],
    bloom: { active: true, str: 10 },
    lighting: true,
    maxLightsPerSceen: 200,
    loadTextures: [
      { name: "char", url: char },
      { name: "map", url: char },
    ],
  });
  AuroraBatcher.setGlobalColorCorrection([0.1, 0.1, 0.1]);
  window.addEventListener("keypress", (e) => {
    if (e.key === "h") {
      if (AuroraBatcher.getRenderData.lighting) {
        AuroraBatcher.setLights(false);
      } else {
        AuroraBatcher.setLights(true);
      }
    }
    if (e.key === "g") {
      if (AuroraBatcher.getRenderData.screenShader.type === "none") {
        AuroraBatcher.setScreenShader("grayscale", 1);
      } else {
        AuroraBatcher.setScreenShader("none");
      }
    }
    if (e.key === "j") {
      if (AuroraBatcher.getRenderData.bloom.active) {
        AuroraBatcher.setBloom(false);
      } else {
        AuroraBatcher.setBloom(true, 16);
      }
    }
    if (e.key === "b") {
      Aurora.resizeCanvas({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  });
  draw();
};

const draw = () => {
  RenderFrame.start();
  AuroraBatcher.startBatch();
  Draw.Quad({
    position: { x: 1000, y: 1000 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 700, width: 700 },
    tint: new Uint8ClampedArray([255, 255, 255]),
    isTexture: 0,
    textureToUse: 1,
    bloom: 0,
  });
  Draw.Quad({
    position: { x: 500, y: 100 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 32, width: 32 },
    tint: new Uint8ClampedArray([255, 255, 255]),
    isTexture: 1,
    textureToUse: 1,
    bloom: 1,
  });
  Draw.Quad({
    position: { x: 700, y: 900 },
    alpha: 255,
    crop: new Float32Array([0, 0, 1, 1]),
    size: { height: 602, width: 32 },
    tint: new Uint8ClampedArray([255, 0, 0]),
    isTexture: 0,
    textureToUse: 0,
    bloom: 0,
  });
  Draw.Quad({
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
  Draw.Text({
    alpha: 255,
    bloom: 0,
    color: new Uint8ClampedArray([80, 80, 250]),
    position: { x: 330, y: 300 },
    text: "abcdefghijklmnoprstua",
    fontFace: "roboto",
    fontSize: 30,
  });
  Draw.Text({
    alpha: 255,
    bloom: 0,
    color: new Uint8ClampedArray([80, 80, 250]),
    position: { x: 330, y: 360 },
    text: "abcdefghijklmnoprstuw",
    fontFace: "roboto",
    fontSize: 30,
  });
  Draw.Light({
    position: { x: 1000, y: 1200 },
    size: { width: 600, height: 600 },
    tint: [50, 255, 50],
    intensity: 255,
    type: "radial",
  });
  Draw.Light({
    position: { x: 500, y: 100 },
    size: { width: 1600, height: 600 },
    tint: [250, 240, 240],
    intensity: 255,
    type: "radial",
  });

  const rend = AuroraBatcher.getRenderData;
  RenderFrame.setGameData({
    lightCurrent: rend.numberOfLights,
    quadsCurrent: rend.numberOfQuads.total,
    lightsLimit: rend.limits.lightsPerFrame,
    quadsLimit: rend.limits.quadsPerFrame,
    blooming: rend.bloom.active,
    bloomStr: rend.bloom.str,
    camera: rend.customCamera ? "custome" : "built-in",
    colorCorr: rend.colorCorrection,
    globalEffect: rend.screenShader.type,
    globalEffectStr: rend.screenShader.str,
    lighting: rend.lighting,
    computeCalls: rend.drawCallsInFrame.compute,
    drawCalls: rend.drawCallsInFrame.render,
  });
  RenderFrame.swapToGPU();
  AuroraBatcher.endBatch();
  RenderFrame.stop();
  requestAnimationFrame(() => draw());
};

createAurora();
