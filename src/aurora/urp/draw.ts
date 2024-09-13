import Vec2D from "../../math/vec2D";
import Aurora from "../auroraCore";
import Batcher from "./batcher";
import Fonter from "./parserTTF/fonter";
import { getTextShape } from "./parserTTF/shapeText";
import GUIPipeline from "./pipelines/guiPipeline";
import LightsPipeline from "./pipelines/lightsPipeline";
import OffscreenPipeline from "./pipelines/offscreenPipeline";

interface SpriteProps {
  position: Position2D;
  size: Size2D;
  textureToUse: number;
  crop: Float32Array;
  tint: Uint8ClampedArray;
  alpha: number;
  isTexture: number;
  bloom: number;
}
interface GUIProps {
  position: Position2D;
  size: Size2D;
  textureToUse: number;
  crop: Float32Array;
  tint: Uint8ClampedArray;
  alpha: number;
  isTexture: number;
}
interface LightProps {
  type: keyof typeof LightsPipeline.getLightTypes;
  position: { x: number; y: number };
  size: { width: number; height: number };
  tint: [number, number, number];
  intensity: number;
}
interface TextProps {
  position: Position2D;
  color: Uint8ClampedArray;
  alpha: number;
  bloom: number;
  text: string;
  fontSize: number;
  fontFace: string;
}

interface GUITextProps {
  position: Position2D;
  color: Uint8ClampedArray;
  alpha: number;
  text: string;
  fontSize: number;
  fontFace: string;
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
    addData[quadsTotal * stride.gameAddData] = tint[0];
    addData[quadsTotal * stride.gameAddData + 1] = tint[1];
    addData[quadsTotal * stride.gameAddData + 2] = tint[2];
    addData[quadsTotal * stride.gameAddData + 3] = alpha;
    addData[quadsTotal * stride.gameAddData + 4] = textureToUse;
    addData[quadsTotal * stride.gameAddData + 5] = isTexture;
    addData[quadsTotal * stride.gameAddData + 6] = 0;
    addData[quadsTotal * stride.gameAddData + 7] = bloom;
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
    text,
    fontFace,
    fontSize,
  }: TextProps) {
    const { LUT, textureIndex } = Fonter.getFontMeta(fontFace);
    const shape = getTextShape(LUT, text, fontSize);
    const vertices = OffscreenPipeline.getVertices;
    const addData = OffscreenPipeline.getAddData;
    const quadsData = Batcher.getRenderData;
    const stride = Batcher.getStride;

    shape.positions.forEach((glyph, index) => {
      const shapePosition = glyph.add(new Vec2D([position.x, position.y]));
      const size = shape.sizes[index];
      const uv = LUT.uvs.get(text[index].charCodeAt(0));

      const quadsTotal = quadsData.numberOfQuads.game;

      vertices[quadsTotal * stride.vertices] = shapePosition.x;
      vertices[quadsTotal * stride.vertices + 1] = shapePosition.y;
      vertices[quadsTotal * stride.vertices + 2] = size.x;
      vertices[quadsTotal * stride.vertices + 3] = size.y;
      vertices[quadsTotal * stride.vertices + 4] = uv.x;
      vertices[quadsTotal * stride.vertices + 5] = uv.y;
      vertices[quadsTotal * stride.vertices + 6] = uv.x + uv.z;
      vertices[quadsTotal * stride.vertices + 7] = uv.y + uv.w;
      addData[quadsTotal * stride.gameAddData] = color[0];
      addData[quadsTotal * stride.gameAddData + 1] = color[1];
      addData[quadsTotal * stride.gameAddData + 2] = color[2];
      addData[quadsTotal * stride.gameAddData + 3] = alpha;
      addData[quadsTotal * stride.gameAddData + 4] = textureIndex;
      addData[quadsTotal * stride.gameAddData + 5] = fontSize;
      addData[quadsTotal * stride.gameAddData + 6] = 1;
      addData[quadsTotal * stride.gameAddData + 7] = bloom;

      quadsData.numberOfQuads.total++;
      quadsData.numberOfQuads.game++;
    });
  }

  public static GUI({
    alpha,
    crop,
    isTexture,
    position,
    size,
    textureToUse,
    tint,
  }: GUIProps) {
    const vertices = GUIPipeline.getVertices;
    const addData = GUIPipeline.getAddData;
    const quadsData = Batcher.getRenderData;
    const quadsTotal = quadsData.numberOfQuads.gui;
    const stride = Batcher.getStride;
    vertices[quadsTotal * stride.vertices] = position.x;
    vertices[quadsTotal * stride.vertices + 1] = position.y;
    vertices[quadsTotal * stride.vertices + 2] = size.width;
    vertices[quadsTotal * stride.vertices + 3] = size.height;
    vertices[quadsTotal * stride.vertices + 4] = crop[0];
    vertices[quadsTotal * stride.vertices + 5] = crop[1];
    vertices[quadsTotal * stride.vertices + 6] = crop[2];
    vertices[quadsTotal * stride.vertices + 7] = crop[3];
    addData[quadsTotal * stride.guiAddData] = tint[0];
    addData[quadsTotal * stride.guiAddData + 1] = tint[1];
    addData[quadsTotal * stride.guiAddData + 2] = tint[2];
    addData[quadsTotal * stride.guiAddData + 3] = alpha;
    addData[quadsTotal * stride.guiAddData + 4] = textureToUse;
    addData[quadsTotal * stride.guiAddData + 5] = isTexture;
    addData[quadsTotal * stride.guiAddData + 6] = 0;
    quadsData.numberOfQuads.total++;
    quadsData.numberOfQuads.gui++;
  }

  public static GUIText({
    alpha,
    position,
    color,
    text,
    fontFace,
    fontSize,
  }: GUITextProps) {
    const { LUT, textureIndex } = Fonter.getFontMeta(fontFace);
    const shape = getTextShape(LUT, text, fontSize);
    // console.log(shape);
    const vertices = GUIPipeline.getVertices;
    const addData = GUIPipeline.getAddData;
    const stride = Batcher.getStride;
    const quadsData = Batcher.getRenderData;
    shape.positions.forEach((glyph, index) => {
      const popo = {
        x: Math.round((position.x / 100) * Aurora.canvas.width),
        y: Math.round((position.y / 100) * Aurora.canvas.height),
      };
      const shapePosition = glyph.add(new Vec2D([popo.x, popo.y]));
      const size = shape.sizes[index];
      const uv = LUT.uvs.get(text[index].charCodeAt(0));

      const finalPos = {
        x: (shapePosition.x / Aurora.canvas.width) * 2 - 1,
        y: (shapePosition.y / Aurora.canvas.height) * 2 - 1,
      };
      const finalSize = {
        x: (size.x / Aurora.canvas.width) * 2,
        y: (size.y / Aurora.canvas.height) * 2,
      };

      const quadsTotal = quadsData.numberOfQuads.gui;

      vertices[quadsTotal * stride.vertices] = finalPos.x;
      vertices[quadsTotal * stride.vertices + 1] = finalPos.y;
      vertices[quadsTotal * stride.vertices + 2] = finalSize.x;
      vertices[quadsTotal * stride.vertices + 3] = finalSize.y;
      vertices[quadsTotal * stride.vertices + 4] = uv.x;
      vertices[quadsTotal * stride.vertices + 5] = uv.y;
      vertices[quadsTotal * stride.vertices + 6] = uv.x + uv.z;
      vertices[quadsTotal * stride.vertices + 7] = uv.y + uv.w;
      addData[quadsTotal * stride.guiAddData] = color[0];
      addData[quadsTotal * stride.guiAddData + 1] = color[1];
      addData[quadsTotal * stride.guiAddData + 2] = color[2];
      addData[quadsTotal * stride.guiAddData + 3] = alpha;
      addData[quadsTotal * stride.guiAddData + 4] = textureIndex;
      addData[quadsTotal * stride.guiAddData + 5] = fontSize;
      addData[quadsTotal * stride.guiAddData + 6] = 1;
      quadsData.numberOfQuads.total++;
      quadsData.numberOfQuads.gui++;
    });
  }
}
