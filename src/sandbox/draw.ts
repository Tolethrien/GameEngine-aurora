import Draw from "../aurora/urp/draw";
import RenderFrame from "../debugger/renderStats/renderFrame";
import AuroraBatcher from "../aurora/urp/batcher";

export const draw = () => {
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

  Draw.GUI({
    position: { x: 0, y: 0 },
    size: { width: 36, height: 22 },
    alpha: 200,
    isTexture: 0,
    textureToUse: 0,
    crop: new Float32Array([0, 0, 1, 1]),
    tint: new Uint8ClampedArray([255, 255, 155]),
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 1 },
    text: "WASD - move around",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 4 },
    text: "Arrow up/down - camera zoom",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 7 },
    text: "Z X C V B N - screen shader on/off",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 10 },
    text: "L - illumination on/off",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 13 },
    text: "K - bloom on/off",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 16 },
    text: "R - resize window to avalible screen",
    fontFace: "roboto",
    fontSize: 15,
  });
  Draw.GUIText({
    alpha: 255,
    color: new Uint8ClampedArray([0, 0, 0]),
    position: { x: 1, y: 19 },
    text: "Note: Resizing currently does not adjust text size correctly",
    fontFace: "roboto",
    fontSize: 12,
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
