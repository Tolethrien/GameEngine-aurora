import { Lookups } from "./parserTypes";

/**
 * Font size used in font atlas.
 */
export const ATLAS_FONT_SIZE = 96;
const ATLAS_RADIUS = ATLAS_FONT_SIZE / 6;
export const ATLAS_GAP = ATLAS_RADIUS / 2;
const DEBUG_FONT_ATLAS_SHOW_GLYPH_BACKGROUNDS = false;

export async function createGlyphAtlas(
  lookups: Lookups,
  buffer: ArrayBuffer,
  options?: {
    alphabet?: string;
    useSDF?: boolean;
  }
) {
  const canvas = document.createElement("canvas");
  canvas.width = lookups.atlas.width;
  canvas.height = lookups.atlas.height;

  const context = canvas.getContext("2d")!;

  const scale = (1 / lookups.unitsPerEm) * ATLAS_FONT_SIZE;

  const fontName = "FontForAtlas";
  const fontFace = new FontFace(fontName, buffer);
  await fontFace.load();
  document.fonts.add(fontFace);

  context.font = `${ATLAS_FONT_SIZE}px ${fontName}`;

  const glyphs = [...lookups.glyphs.values()];
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const position = lookups.atlas.positions[i];
    const size = lookups.atlas.sizes[i];

    if (DEBUG_FONT_ATLAS_SHOW_GLYPH_BACKGROUNDS) {
      context.fillStyle = "rgba(255, 0, 255, 0.3)";
      context.fillRect(position.x, position.y, size.x, size.y);
    }

    context.fillStyle = "rgba(255, 255, 255, 1)";
    context.fillText(
      String.fromCharCode(glyph.id),
      // Additionally offset by glyph (X, Y).
      position.x - glyph.x * scale + ATLAS_GAP,
      position.y + size.y + glyph.y * scale - ATLAS_GAP
    );
  }

  if (options?.useSDF) {
    // Apply SDF.
    const imageData = context.getImageData(
      0,
      0,
      lookups.atlas.width,
      lookups.atlas.height
    );
    const sdfData = toSDF(
      imageData,
      lookups.atlas.width,
      lookups.atlas.height,
      ATLAS_RADIUS
    );
    context.putImageData(sdfData, 0, 0);
  }

  return await createImageBitmap(canvas);
}
export function toSDF(
  imageData: ImageData,
  width: number,
  height: number,
  radius: number
): ImageData {
  const gridOuter = new Float64Array(width * height);
  const gridInner = new Float64Array(width * height);

  const INF = 1e20;
  for (let i = 0; i < width * height; i++) {
    const a = imageData.data[i * 4 + 3] / 255; // Alpha value.
    gridOuter[i] =
      a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
    gridInner[i] =
      a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
  }

  const s = Math.max(width, height);
  const f = new Float64Array(s);
  const z = new Float64Array(s + 1);
  const v = new Uint16Array(s * 2);

  edt(gridOuter, width, height, f, v, z);
  edt(gridInner, width, height, f, v, z);

  const alphaChannel = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
    const buffer = 0.5;
    const value = buffer - d / radius;

    alphaChannel[i] = value * 255;
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[4 * i + 0] = alphaChannel[i];
    data[4 * i + 1] = alphaChannel[i];
    data[4 * i + 2] = alphaChannel[i];
    data[4 * i + 3] = alphaChannel[i];
  }

  return new ImageData(data, width, height);
}

const INF = 1e20;

// 1D squared distance transform.
function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array
): void {
  let q: number, k: number, s: number, r: number;

  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (q = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
  }

  for (q = 1, k = 0, s = 0; q < length; q++) {
    do {
      r = v[k];
      s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);

    k++;

    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) {
      k++;
    }

    r = v[k];
    grid[offset + q * stride] = f[r] + (q - r) * (q - r);
  }
}

function edt(
  data: Float64Array,
  width: number,
  height: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array
): void {
  for (let x = 0; x < width; x++) {
    edt1d(data, x, width, height, f, v, z);
  }
  for (let y = 0; y < height; y++) {
    edt1d(data, y * width, 1, width, f, v, z);
  }
}
