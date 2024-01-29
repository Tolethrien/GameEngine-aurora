import Aurora from "../auroraCore";
import AuroraTexture from "../auroraTexture";
import Batcher from "./batcher";
import LightsPipeline from "./pipelines/lightsPipeline";
import OffscreenPipeline from "./pipelines/offscreenPipeline";

interface SpriteProps {
  position: { x: number; y: number };
  size: { width: number; height: number };
  textureToUse: number;
  crop: Float32Array;
  tint: Uint8ClampedArray;
  alpha: number;
  isTexture: number;
  bloom: number;
}
interface LightProps {
  type: keyof typeof LightsPipeline.getLightTypes;
  position: { x: number; y: number };
  size: { width: number; height: number };
  tint: [number, number, number];
  intensity: number;
}
interface TextProps {
  position: { x: number; y: number };
  weight: number;
  textureToUse: number;
  color: Uint8ClampedArray;
  alpha: number;
  bloom: number;
  text: string;
}
export default class Draw {
  public static Quad({
    position,
    size,
    textureToUse,
    crop,
    alpha,
    tint,
    isTexture,
    bloom,
  }: SpriteProps) {
    const vertices = OffscreenPipeline.getVertices;
    const addData = OffscreenPipeline.getAddData;
    const quadsData = Batcher.getRenderData;
    const quadsTotal = quadsData.numberOfQuads.game;
    const stride = Batcher.getStride;
    vertices[quadsTotal * stride.vertices] = position.x;
    vertices[quadsTotal * stride.vertices + 1] = position.y;
    vertices[quadsTotal * stride.vertices + 2] = size.width;
    vertices[quadsTotal * stride.vertices + 3] = size.height;
    vertices[quadsTotal * stride.vertices + 4] = crop[0];
    vertices[quadsTotal * stride.vertices + 5] = crop[1];
    vertices[quadsTotal * stride.vertices + 6] = crop[2];
    vertices[quadsTotal * stride.vertices + 7] = crop[3];
    addData[quadsTotal * stride.addData] = tint[0];
    addData[quadsTotal * stride.addData + 1] = tint[1];
    addData[quadsTotal * stride.addData + 2] = tint[2];
    addData[quadsTotal * stride.addData + 3] = alpha;
    addData[quadsTotal * stride.addData + 4] = textureToUse;
    addData[quadsTotal * stride.addData + 5] = isTexture;
    addData[quadsTotal * stride.addData + 6] = 0;
    addData[quadsTotal * stride.addData + 7] = bloom;
    quadsData.numberOfQuads.total++;
    quadsData.numberOfQuads.game++;
  }
  public static Light({ intensity, position, size, tint, type }: LightProps) {
    const lights = LightsPipeline.getLightsData;
    const lightsTotal = Batcher.getRenderData.numberOfLights;
    const stride = Batcher.getStride;
    const lightTypes = LightsPipeline.getLightTypes;
    lights[(1 + lightsTotal) * stride.lights] = position.x;
    lights[(1 + lightsTotal) * stride.lights + 1] = position.y;
    lights[(1 + lightsTotal) * stride.lights + 2] = size.width;
    lights[(1 + lightsTotal) * stride.lights + 3] = size.height;
    lights[(1 + lightsTotal) * stride.lights + 4] = tint[0];
    lights[(1 + lightsTotal) * stride.lights + 5] = tint[1];
    lights[(1 + lightsTotal) * stride.lights + 6] = tint[2];
    lights[(1 + lightsTotal) * stride.lights + 7] = intensity;
    lights[(1 + lightsTotal) * stride.lights + 8] = lightTypes[type];
    Batcher.getRenderData.numberOfLights++;
  }
  public static Text({
    alpha,
    bloom,
    color,
    position,
    textureToUse,
    weight,
    text,
  }: TextProps) {
    //TODO: znormalizowac jesli renderujesz UI
    let xPos = position.x;
    const { height: imgHeight, width: imgWidth } =
      AuroraTexture.getTexture("fonts").meta;
    const vertices = OffscreenPipeline.getVertices;
    const addData = OffscreenPipeline.getAddData;
    const quadsData = Batcher.getRenderData;
    const stride = Batcher.getStride;
    const renderGui = false;
    Array.from(text).forEach((char) => {
      const quadsTotal = quadsData.numberOfQuads.game;
      const glyph = Batcher.getFontData[char.charCodeAt(0)];
      let width, height, advence, offsetY;
      if (renderGui) {
        width = (glyph.width * weight) / Aurora.canvas.width;
        height = (glyph.height * weight) / Aurora.canvas.height;
        advence = (glyph.xadvance * weight) / Aurora.canvas.width;
        offsetY = (glyph.yoffset * weight) / Aurora.canvas.height;
      } else {
        width = glyph.width * weight;
        height = glyph.height * weight;
        advence = glyph.xadvance * weight;
        offsetY = glyph.yoffset * weight;
      }
      vertices[quadsTotal * stride.vertices] = xPos + width / 2;
      vertices[quadsTotal * stride.vertices + 1] =
        position.y + height / 2 + (renderGui ? 0 : offsetY);
      vertices[quadsTotal * stride.vertices + 2] = width / 2;
      vertices[quadsTotal * stride.vertices + 3] = height / 2;
      vertices[quadsTotal * stride.vertices + 4] = glyph.x / imgWidth;
      vertices[quadsTotal * stride.vertices + 5] = glyph.y / imgHeight;
      vertices[quadsTotal * stride.vertices + 6] =
        glyph.x / imgWidth + glyph.width / imgWidth;
      vertices[quadsTotal * stride.vertices + 7] =
        glyph.y / imgHeight + glyph.height / imgHeight;
      addData[quadsTotal * stride.addData] = color[0];
      addData[quadsTotal * stride.addData + 1] = color[1];
      addData[quadsTotal * stride.addData + 2] = color[2];
      addData[quadsTotal * stride.addData + 3] = alpha;
      addData[quadsTotal * stride.addData + 4] = textureToUse;
      addData[quadsTotal * stride.addData + 5] = 0;
      addData[quadsTotal * stride.addData + 6] = 1;
      addData[quadsTotal * stride.addData + 7] = bloom;
      quadsData.numberOfQuads.total++;
      renderGui
        ? quadsData.numberOfQuads.gui++
        : quadsData.numberOfQuads.game++;
      xPos += advence;
    });
  }
}
