import Aurora from "./auroraCore";
type LoadedImages = Map<string, { image: HTMLImageElement; index: number }>;
type LoadedAtlases = Map<string, { texture: GPUTexture; sampler: GPUSampler }>;
export type GPULoadedTexture = { texture: GPUTexture; sampler: GPUSampler };
export default class AuroraTexture {
  public static loadedImages: LoadedImages = new Map();
  public static loadedAtlases: LoadedAtlases = new Map();

  public static async createTexture(url: string) {
    const image = await this.loadImage(url);

    return await this.createGPUTexture(image);
  }
  public static async createTextureArray(
    urls: { name: string; url: string }[]
  ) {
    if (urls.length === 0)
      throw new Error("trying to load empty array of images");
    const images: HTMLImageElement[] = [];
    for (const { name, url } of urls) {
      const img = await this.loadImage(url);
      this.loadedImages.set(name, {
        image: img,
        index: this.loadedImages.size,
      });
      images.push(img);
    }
    const texture = await this.createGPUTextureAtlas(images);
    this.loadedAtlases.set(
      `GPUTextureAtlasIndex:${this.loadedAtlases.size}`,
      texture
    );
    return texture;
  }
  private static async loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolved, rejected) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        resolved(image);
      };
      image.onerror = (err) => {
        rejected(err);
      };
    });
  }
  private static async createGPUTextureAtlas(images: HTMLImageElement[]) {
    /**TODO: fix - every texture need to be same size */
    const texture = Aurora.device.createTexture({
      format: "rgba8unorm",
      size: {
        width: images[0].width,
        height: images[0].height,
        depthOrArrayLayers: images.length,
      },
      dimension: "2d",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const datas: ImageBitmap[] = [];
    for (const image of images) {
      datas.push(await createImageBitmap(image));
    }
    datas.forEach((data, index) => {
      Aurora.device.queue.copyExternalImageToTexture(
        { source: data },
        { texture: texture, origin: { z: index } },
        {
          width: images[0].width,
          height: images[0].height,
        }
      );
    });
    const sampler = Aurora.device.createSampler();
    return { texture, sampler };
  }
  private static async createGPUTexture(image: HTMLImageElement) {
    const texture = Aurora.device.createTexture({
      format: "rgba8unorm",
      size: {
        width: image.width,
        height: image.height,
      },
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const data = await createImageBitmap(image);
    Aurora.device.queue.copyExternalImageToTexture(
      { source: data },
      { texture: texture },
      {
        width: image.width,
        height: image.height,
      }
    );

    const sampler = Aurora.device.createSampler();
    return { texture, sampler };
  }
  public static createEmptyTexture(width: number, height: number) {
    const texture = Aurora.device.createTexture({
      format: "bgra8unorm",
      size: {
        width: width,
        height: height,
      },
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const sampler = Aurora.device.createSampler();
    return { texture, sampler };
  }
}
