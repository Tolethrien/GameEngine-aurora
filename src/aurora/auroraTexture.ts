import Aurora from "./auroraCore";
export type ImgMeta = {
  width: number;
  height: number;
  src: string;
  name?: string;
  index?: number;
};
export interface GPUAuroraTexture {
  texture: GPUTexture;
  label: string;
  meta: {
    src: Map<string, ImgMeta>;
    width: number;
    height: number;
    arrayTextureLength?: number;
  };
}
export interface GeneralTextureProps {
  format?: GPUTextureFormat;
  label: string;
}

export default class AuroraTexture {
  public static textureStore: Map<string, GPUAuroraTexture> = new Map();
  public static samplerStore: Map<string, GPUSampler> = new Map();
  public static useStore = true;
  public static flipY = false;
  public static createSampler(label: string, desc?: GPUSamplerDescriptor) {
    const sampler = Aurora.device.createSampler(desc);
    this.samplerStore.set(label, sampler);
    return sampler;
  }
  public static async createTexture({
    format,
    label,
    url,
  }: GeneralTextureProps & { url: string }) {
    const bitmap = await createImageBitmap(await this.loadImage(url, label));
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: bitmap.width,
        height: bitmap.height,
      },
      label,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    Aurora.device.queue.copyExternalImageToTexture(
      { source: bitmap, flipY: this.flipY },
      { texture: texture },
      {
        width: bitmap.width,
        height: bitmap.height,
      }
    );
    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,
        src: new Map([
          [
            label,
            {
              height: bitmap.height,
              width: bitmap.width,
              src: url,
            },
          ],
        ]),
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static createTextureEmpty({
    label,
    format,
    size,
  }: GeneralTextureProps & { size: { width: number; height: number } }) {
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: size.width,
        height: size.height,
      },
      label,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.STORAGE_BINDING,
    });

    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,
        src: new Map([
          [
            label,
            { height: texture.height, width: texture.width, src: "empty" },
          ],
        ]),
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static createTextureFromBitmap({
    bitmap,
    label,
    format,
  }: GeneralTextureProps & { bitmap: ImageBitmap }) {
    const texture = Aurora.device.createTexture({
      label,
      size: {
        width: bitmap.width,
        height: bitmap.height,
      },
      format: format ?? "rgba8unorm",

      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    Aurora.device.queue.copyExternalImageToTexture(
      { source: bitmap, flipY: this.flipY },
      { texture: texture },
      { width: bitmap.width, height: bitmap.height }
    );
    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,
        src: new Map([
          [
            label,
            { height: texture.height, width: texture.width, src: "bitmap" },
          ],
        ]),
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static async createTextureArray({
    format,
    label,
    textures,
  }: GeneralTextureProps & {
    textures: { name: string; url: string }[];
  }) {
    this.checkLenght(textures, label);
    const bitMaps: ImageBitmap[] = [];
    for (const { url } of textures) {
      bitMaps.push(await createImageBitmap(await this.loadImage(url, label)));
    }
    const { textureHeight, textureWidth } = this.calculateDimension(bitMaps);
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: textureWidth,
        height: textureHeight,
        depthOrArrayLayers: textures.length,
      },
      label,
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const textureMeta: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,

        src: new Map(),
        arrayTextureLength: bitMaps.length,
      },
    };
    bitMaps.forEach((bitMap, index) => {
      textureMeta.meta.src.set(textures[index].name, {
        width: bitMap.width,
        height: bitMap.height,
        index,
        name: textures[index].name,
        src: textures[index].url,
      });
      Aurora.device.queue.copyExternalImageToTexture(
        { source: bitMap, flipY: this.flipY },
        { texture: texture, origin: { z: index } },
        {
          width: bitMap.width,
          height: bitMap.height,
        }
      );
    });

    this.useStore && this.textureStore.set(label, textureMeta);
    return textureMeta;
  }
  public static createTextureArrayFromBitmap({
    bitmaps,
    label,
    format,
  }: GeneralTextureProps & {
    bitmaps: { name: string; bitmap: ImageBitmap }[];
  }) {
    // this.checkLenght(bitmaps, label);
    const { textureHeight, textureWidth } = this.calculateDimension(
      bitmaps.map((bit) => bit.bitmap)
    );
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: textureWidth,
        height: textureHeight,
        depthOrArrayLayers: bitmaps.length,
      },
      label,
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const textureMeta: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,
        src: new Map(),
        arrayTextureLength: bitmaps.length,
      },
    };
    bitmaps.forEach(({ bitmap, name }, index) => {
      textureMeta.meta.src.set(name, {
        width: bitmap.width,
        height: bitmap.height,
        index,
        name: name,
        src: "bitmap",
      });

      Aurora.device.queue.copyExternalImageToTexture(
        { source: bitmap, flipY: this.flipY },
        { texture: texture, origin: { z: index } },
        {
          width: bitmap.width,
          height: bitmap.height,
        }
      );
    });

    this.useStore && this.textureStore.set(label, textureMeta);
    return textureMeta;
  }
  public static createTextureArrayEmpty({
    label,
    format,
    texturesSize,
    length,
  }: GeneralTextureProps & {
    texturesSize: { width: number; height: number };
    length: number | string[];
  }) {
    const lngth = typeof length === "number" ? length : length.length;
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: texturesSize.width,
        height: texturesSize.height,
        depthOrArrayLayers: lngth,
      },
      label,
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.STORAGE_BINDING,
    });
    const textureMeta: GPUAuroraTexture = {
      texture: texture,
      label,
      meta: {
        height: texture.height,
        width: texture.width,
        src: new Map(),
        arrayTextureLength: lngth,
      },
    };
    Array(lngth)
      .fill(null)
      .forEach((_, index) => {
        const name = Array.isArray(length) ? length[index] : index.toString();
        textureMeta.meta.src.set(name, {
          width: texturesSize.width,
          height: texturesSize.height,
          index,
          src: "empty",
          name: name,
        });
      });
    this.useStore && this.textureStore.set(label, textureMeta);
    return textureMeta;
  }

  public static getTexture(label: string) {
    const texture = this.textureStore.get(label);
    this.assertAsset(texture, label, "Texture");
    return texture;
  }

  public static getSampler(label: string) {
    const sampler = this.samplerStore.get(label);
    this.assertAsset(sampler, label, "Sampler");
    return sampler;
  }
  public static removeTexture(label: string) {
    this.textureStore.delete(label);
  }
  public static removeSampler(label: string) {
    this.samplerStore.delete(label);
  }
  public static get getStore() {
    return this.textureStore;
  }
  private static async loadImage(url: string, label: string) {
    return new Promise<HTMLImageElement>((resolved) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        resolved(image);
      };
      image.onerror = (err) => {
        throw new Error(
          `AuroraTexture Error: caught trying to load image from url: "${url}" in texture labeled: "${label}".\nMake sure string and file format are correct\nPromiseError: ${err}`
        );
      };
    });
  }
  private static calculateDimension(textures: ImageBitmap[]) {
    let textureWidth = 0;
    let textureHeight = 0;
    textures.forEach((bitmap) => {
      if (bitmap.width > textureWidth) textureWidth = bitmap.width;
      if (bitmap.height > textureHeight) textureHeight = bitmap.height;
    });
    return { textureWidth, textureHeight };
  }
  private static checkLenght(arr: unknown[], label: string): asserts arr {
    if (arr.length === 0 || arr.length === 1)
      throw new Error(
        `AuroraTexture Error: Textures length too short\nTexture Label: ${label}\nMinimal Textures in Array: 2\nActual Textures added: ${arr.length}`
      );
  }
  private static assertAsset(
    asset: unknown,
    label: string,
    type: string
  ): asserts asset {
    if (!asset)
      throw new Error(
        `AuroraTexture Error: Trying to get ${type} with label: ${label}, but it doesn't exist`
      );
  }
}
