import { ATLAS_FONT_SIZE, ATLAS_GAP } from "./glyphAtlas";
import {
  ClassDefFormat1,
  ClassDefFormat2,
  Glyph,
  Lookups,
  TTF,
  ValueRecord,
} from "./parserTypes";
import Vec2D from "../../../math/vec2D";
import Vec4D from "../../../math/vec4D";
import { validateValue } from "../../../utils/utils";

export function createGlyphLUT(
  ttf: TTF,
  options?: {
    alphabet?: string;
  }
): Lookups {
  const scale = (1 / ttf.head.unitsPerEm) * ATLAS_FONT_SIZE;
  const glyphs = calculateGlyphQuads(ttf, options?.alphabet);

  const transform = (x: number): number => Math.ceil(x * scale);

  const sizes = glyphs.map(
    (g) =>
      new Vec2D([
        transform(g.width) + ATLAS_GAP * 2,
        transform(g.height) + ATLAS_GAP * 2,
      ])
  );
  const packing = packShelves(sizes);

  const atlas = {
    width: packing.width,
    height: packing.height,
    positions: packing.positions,
    sizes,
  };

  const uvs: Vec4D[] = [];

  for (let i = 0; i < glyphs.length; i++) {
    const position = atlas.positions[i];
    const size = atlas.sizes[i];
    uvs.push(
      new Vec4D([
        position.x / atlas.width,
        position.y / atlas.height,
        size.x / atlas.width,
        size.y / atlas.height,
      ])
    );
  }

  const glyphMap = new Map<number, Glyph>();
  for (const glyph of glyphs) {
    glyphMap.set(glyph.id, glyph);
  }

  const uvMap = new Map<number, Vec4D>();
  for (let i = 0; i < glyphs.length; i++) {
    uvMap.set(glyphs[i].id, uvs[i]);
  }

  const kerningPairs = new Map<number, Map<number, number>>();
  let firstGlyphClassMapping = new Map<number, number>();
  let secondGlyphClassMapping = new Map<number, number>();

  let classRecords: {
    value1?: ValueRecord | undefined;
    value2?: ValueRecord | undefined;
  }[][] = [];

  const kern = ttf.GPOS?.features.find((f) => f.tag === "kern");
  if (kern) {
    const lookups = kern.lookupListIndices.map((id) => ttf.GPOS?.lookups[id]);

    for (const lookup of lookups) {
      if (lookup && (lookup.lookupType === 2 || lookup.lookupType === 9)) {
        // Ensure it's Pair Adjustment
        for (const subtable of lookup.subtables) {
          if (lookup.lookupType === 9 && subtable.extensionLookupType === 2) {
            const coverage = subtable.extension.coverage;

            if (subtable.extension.posFormat === 1) {
              // Adjustment for glyph pairs.
              const pairSets = subtable.extension.pairSets;

              if (coverage.coverageFormat === 2) {
                let indexCounter = 0;
                for (const range of coverage.rangeRecords) {
                  for (
                    let glyphID = range.startGlyphID;
                    glyphID <= range.endGlyphID;
                    glyphID++
                  ) {
                    const pairs = pairSets[indexCounter];

                    const glyphKernMap =
                      kerningPairs.get(glyphID) || new Map<number, number>();
                    for (const pair of pairs) {
                      if (pair.value1?.xAdvance) {
                        glyphKernMap.set(
                          pair.secondGlyph,
                          pair.value1.xAdvance
                        );
                      }
                    }
                    if (glyphKernMap.size > 0) {
                      kerningPairs.set(glyphID, glyphKernMap);
                    }

                    indexCounter++;
                  }
                }
              } else {
                console.warn(
                  `Coverage format ${coverage.coverageFormat} is not supported.`
                );
              }
            } else if (subtable.extension.posFormat === 2) {
              // Adjustment for glyph classes.
              if (coverage.coverageFormat === 2) {
                const { classDef1, classDef2 } = subtable.extension;
                firstGlyphClassMapping = generateGlyphToClassMap(classDef1);
                secondGlyphClassMapping = generateGlyphToClassMap(classDef2);
                classRecords = subtable.extension.classRecords;
              } else {
                console.warn(
                  `Coverage format ${coverage.coverageFormat} is not supported.`
                );
              }
            }
          }
        }
      }
    }
  }

  return {
    atlas,
    unitsPerEm: ttf.head.unitsPerEm,
    capHeight: ttf.hhea.ascender + ttf.hhea.descender,
    ascender: ttf.hhea.ascender,
    glyphs: glyphMap,
    uvs: uvMap,
    kern: (firstCharacter: number, secondCharacter: number): number => {
      if (!ttf.GPOS) {
        return 0;
      }

      const firstGlyphID = ttf.cmap.glyphIndexMap.get(firstCharacter);
      const secondGlyphID = ttf.cmap.glyphIndexMap.get(secondCharacter);
      validateValue(firstGlyphID, `Glyph not found for: "${firstCharacter}"`);
      validateValue(secondGlyphID, `Glyph not found for: "${secondCharacter}"`);

      const firstMap = kerningPairs.get(firstGlyphID);
      if (firstMap) {
        if (firstMap.get(secondGlyphID)) {
          return firstMap.get(secondGlyphID) ?? 0;
        }
      }

      const firstClass = firstGlyphClassMapping.get(firstGlyphID);
      const secondClass = secondGlyphClassMapping.get(secondGlyphID);

      if (firstClass && secondClass) {
        const record = classRecords[firstClass][secondClass];
        return record.value1?.xAdvance ?? 0;
      }

      return 0;
    },
    ttf,
  };
}

function generateGlyphToClassMap(
  classDef: ClassDefFormat1 | ClassDefFormat2
): Map<number, number> {
  const glyphToClass = new Map<number, number>();

  if (classDef.format === 1) {
    // ClassDefFormat1
    let glyphID = classDef.startGlyph;
    for (const classValue of classDef.classes) {
      glyphToClass.set(glyphID, classValue);
      glyphID++;
    }
  } else if (classDef.format === 2) {
    // ClassDefFormat2
    for (const range of classDef.ranges) {
      for (
        let glyphID = range.startGlyphID;
        glyphID <= range.endGlyphID;
        glyphID++
      ) {
        glyphToClass.set(glyphID, range.class);
      }
    }
  }

  return glyphToClass;
}

/**
 * Internal.
 */
function calculateGlyphQuads(ttf: TTF, alphabet?: string): Glyph[] {
  const charCodes = alphabet
    ? alphabet.split("").map((c) => c.charCodeAt(0))
    : [...ttf.cmap.glyphIndexMap.keys()];

  return charCodes.map((code) => {
    validateValue(ttf, "TTF is missing.");

    const index = ttf.cmap.glyphIndexMap.get(code);

    validateValue(
      index,
      `Couldn't find index for character '${String.fromCharCode(
        code
      )}' in glyphIndexMap.`
    );
    validateValue(
      index < ttf.glyf.length,
      "Index is out of bounds for glyf table."
    );

    const lastMetric = ttf.hmtx.hMetrics.at(-1);
    validateValue(
      lastMetric,
      "The last advance is missing, which means that hmtx table is probably empty."
    );

    const hmtx =
      index < ttf.hhea.numberOfHMetrics
        ? ttf.hmtx.hMetrics[index]
        : {
            leftSideBearing:
              ttf.hmtx.leftSideBearings[index - ttf.hhea.numberOfHMetrics],
            advanceWidth: lastMetric.advanceWidth,
          };
    const glyf = ttf.glyf[index];

    const glyph: Glyph = {
      id: code,
      character: String.fromCharCode(code),
      x: glyf.xMin,
      y: glyf.yMin,
      width: glyf.xMax - glyf.xMin,
      height: glyf.yMax - glyf.yMin,
      lsb: hmtx.leftSideBearing,
      rsb: hmtx.advanceWidth - hmtx.leftSideBearing - (glyf.xMax - glyf.xMin),
    };

    return glyph;
  });
}
export type Packing = {
  width: number;
  height: number;
  positions: Vec2D[];
};

/**
 * Takes sizes of rectangles and packs them into a single texture. Width and
 * height will be the next power of two.
 */
export function packShelves(sizes: Vec2D[]): Packing {
  let area = 0;
  let maxWidth = 0;

  const rectangles = sizes.map((rectangle, i) => ({
    id: i,
    x: 0,
    y: 0,
    width: rectangle.x,
    height: rectangle.y,
  }));

  for (const box of rectangles) {
    area += box.width * box.height;
    maxWidth = Math.max(maxWidth, box.width);
  }

  rectangles.sort((a, b) => b.height - a.height);

  // Aim for a squarish resulting container. Slightly adjusted for sub-100%
  // space utilization.
  const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth);

  const regions = [{ x: 0, y: 0, width: startWidth, height: Infinity }];

  let width = 0;
  let height = 0;

  for (const box of rectangles) {
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (box.width > region.width || box.height > region.height) {
        continue;
      }

      box.x = region.x;
      box.y = region.y;
      height = Math.max(height, box.y + box.height);
      width = Math.max(width, box.x + box.width);

      if (box.width === region.width && box.height === region.height) {
        const last = regions.pop();
        validateValue(last, "Regions array should not be empty.");

        if (i < regions.length) {
          regions[i] = last;
        }
      } else if (box.height === region.height) {
        region.x += box.width;
        region.width -= box.width;
      } else if (box.width === region.width) {
        region.y += box.height;
        region.height -= box.height;
      } else {
        regions.push({
          x: region.x + box.width,
          y: region.y,
          width: region.width - box.width,
          height: box.height,
        });

        region.y += box.height;
        region.height -= box.height;
      }
      break;
    }
  }

  const size = Math.max(ceilPow2(width), ceilPow2(height));
  rectangles.sort((a, b) => a.id - b.id);

  return {
    width: size,
    height: size,
    positions: rectangles.map(
      (rectangle) => new Vec2D([rectangle.x, rectangle.y])
    ),
  };
}

function ceilPow2(x: number): number {
  let value = x;
  value -= 1;
  value |= value >> 1;
  value |= value >> 2;
  value |= value >> 4;
  value |= value >> 8;
  value |= value >> 16;
  value += 1;
  return value;
}
