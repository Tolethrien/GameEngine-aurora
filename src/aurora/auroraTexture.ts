import Aurora from "./auroraCore";
export type GPULoadedTexture = { texture: GPUTexture; sampler: GPUSampler };
interface GPUAuroraTexture {
  texture: GPUTexture;
  meta: {
    src: string | string[];
    customeSampler?: string;
    width: number;
    height: number;
    arrayTexture?: {
      numberOfLayers: number;
      totalWidth: number;
      totalHeight: number;
    };
  };
}
interface GeneralTextureProps {
  format?: GPUTextureFormat;
  label: string;
  samplerLabel?: string;
}

export default class AuroraTexture {
  public static textureStore: Map<string, GPUAuroraTexture> = new Map();
  public static useStore = true;
  public static createSampler(desc?: GPUSamplerDescriptor) {
    return Aurora.device.createSampler(desc);
  }
  public static async createTexture({
    format,
    label,
    url,
    samplerLabel,
  }: GeneralTextureProps & {
    url: string;
  }) {
    const bitmap = await createImageBitmap(await this.loadImage(url, label));
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: bitmap.width,
        height: bitmap.height,
      },
      label: label,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    Aurora.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: texture },
      {
        width: bitmap.width,
        height: bitmap.height,
      }
    );
    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      meta: {
        height: texture.height,
        width: texture.width,
        src: url,
        customeSampler: samplerLabel ?? "none",
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static async createTextureArray({
    format,
    label,
    urls,
    samplerLabel,
  }: GeneralTextureProps & {
    urls: string[];
  }) {
    if (urls.length === 0 || urls.length === 1)
      console.error(
        `AuroraTexture Error: trying to load empty array of images or passing only one image in texture labeled ${label}.\nNote: Texture Arrays required at least 2 textures to work`
      );

    const bitMaps: ImageBitmap[] = [];
    for (const url of urls) {
      bitMaps.push(await createImageBitmap(await this.loadImage(url, label)));
    }
    this.checkRange(bitMaps[0].width, bitMaps[0].height, bitMaps.length, label);
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: bitMaps[0].width,
        height: bitMaps[0].height,
        depthOrArrayLayers: bitMaps.length,
      },
      label: label,
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    bitMaps.forEach((bitMap, index) =>
      Aurora.device.queue.copyExternalImageToTexture(
        { source: bitMap },
        { texture: texture, origin: { z: index } },
        {
          width: bitMap.width,
          height: bitMap.height,
        }
      )
    );

    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      meta: {
        height: texture.height,
        width: texture.width,
        src: urls,
        customeSampler: samplerLabel ?? "none",
        arrayTexture: {
          numberOfLayers: bitMaps.length,
          totalHeight: bitMaps[0].height * bitMaps.length,
          totalWidth: bitMaps[0].width * bitMaps.length,
        },
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }

  public static createEmptyTexture({
    format,
    label,
    samplerLabel,
    size,
  }: GeneralTextureProps & {
    size: { width: number; height: number };
  }) {
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: size.width,
        height: size.height,
      },
      label: label,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.STORAGE_BINDING,
    });

    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      meta: {
        height: texture.height,
        width: texture.width,
        src: "empty",
        customeSampler: samplerLabel ?? "none",
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static createEmptyTextureArray({
    format,
    label,
    samplerLabel,
    size,
  }: GeneralTextureProps & {
    size: { width: number; height: number; arraySize: number };
  }) {
    this.checkRange(size.width, size.height, size.arraySize, label);
    const texture = Aurora.device.createTexture({
      format: format ?? "bgra8unorm",
      size: {
        width: size.width,
        height: size.height,
        depthOrArrayLayers: size.arraySize,
      },
      label: label,
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const finalTexture: GPUAuroraTexture = {
      texture: texture,
      meta: {
        height: texture.height,
        width: texture.width,
        src: "empty",
        customeSampler: samplerLabel ?? "none",
        arrayTexture: {
          numberOfLayers: size.arraySize,
          totalHeight: size.height * size.arraySize,
          totalWidth: size.width * size.arraySize,
        },
      },
    };
    this.useStore && this.textureStore.set(label, finalTexture);
    return finalTexture;
  }
  public static getTexture(label: string) {
    return this.textureStore.get(label);
  }
  public static removeTexture(label: string) {
    this.textureStore.delete(label);
  }
  public static get getStore() {
    return this.textureStore;
  }
  private static async loadImage(url: string, label: string) {
    return new Promise<HTMLImageElement>((resolved, rejected) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        resolved(image);
      };
      image.onerror = (err) => {
        console.error(
          `AuroraTexture Error: caught trying to load image from url: "${url}" in texture labeled: "${label}".\nMake sure string and file format are correct`
        );
        rejected(err);
      };
    });
  }
  private static checkRange(
    width: number,
    height: number,
    length: number,
    label: string
  ) {
    if (length * width > 8000 || length * height > 8000)
      throw new RangeError(
        `Texture array ${label} is to big! max size is 8000x8000 px, you trying to create ${
          length * width
        }x${length * height} px`
      );
  }
}
