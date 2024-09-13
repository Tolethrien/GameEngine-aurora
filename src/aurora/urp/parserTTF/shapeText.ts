import Vec2D from "../../../math/vec2D";
import { validateValue } from "../../../utils/utils";
import { ATLAS_FONT_SIZE, ATLAS_GAP } from "./glyphAtlas";
import { Lookups, Shape } from "./parserTypes";

export const ENABLE_KERNING = true;
export function getTextShape(
  lookups: Lookups,
  text: string,
  fontSize: number
): Shape {
  const positions: Vec2D[] = [];
  const sizes: Vec2D[] = [];

  let positionX = 0;
  const scale = (1 / lookups.unitsPerEm) * fontSize;
  const padding = (ATLAS_GAP * fontSize) / ATLAS_FONT_SIZE;

  for (let i = 0; i < text.length; i++) {
    const character = text[i].charCodeAt(0);
    const glyph = lookups.glyphs.get(character);
    validateValue(glyph, `Glyph not found for character ${text[i]}`);

    const { y, width, height, lsb, rsb } = glyph;

    let kerning = 0;
    if (ENABLE_KERNING && text[i - 1] && text[i]) {
      kerning = lookups.kern(text[i - 1].charCodeAt(0), text[i].charCodeAt(0));
    }

    positions.push(
      new Vec2D([
        positionX + (lsb + kerning) * scale - padding,
        (lookups.capHeight - y - height) * scale - padding,
      ])
    );

    // 2 * padding is to account for padding from both sides of the glyph.
    sizes.push(
      new Vec2D([width * scale + padding * 2, height * scale + padding * 2])
    );
    positionX += (lsb + kerning + width + rsb) * scale;
  }

  const width =
    (positions[positions.length - 1]?.x ?? 0) + sizes[sizes.length - 1].x;
  const height = (lookups.capHeight * fontSize) / lookups.unitsPerEm;

  return {
    positions,
    sizes,
    // Round up avoid layout gaps.
    boundingRectangle: {
      width: Math.ceil(width),
      height: Math.ceil(height),
    },
  };
}
