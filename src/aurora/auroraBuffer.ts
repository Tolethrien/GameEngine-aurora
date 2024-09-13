import Aurora from "./auroraCore";
type bufferType = "vertex" | "index" | "storage" | "uniform";
interface DynamicBufferOptions {
  bufferType: bufferType;
  typedArr: InstanceType<(typeof TYPED_MAP)[keyof typeof TYPED_MAP]>;
  label: string;
  storeInMap?: boolean;
}
interface MapedBufferOptions {
  bufferType: bufferType;
  dataType: keyof typeof TYPED_MAP;
  data: number[];
  label: string;
  storeInMap?: boolean;
}
type Buffers = Map<string, GPUBuffer>;
const TYPED_MAP = {
  Float32Array,
  Float64Array,
  Uint16Array,
  Uint32Array,
  Uint8Array,
};
const USAGE_MAP = {
  dynamic: {
    vertex: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    index: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    storage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    uniform: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  },
  maped: {
    vertex: GPUBufferUsage.VERTEX,
    index: GPUBufferUsage.INDEX,
    storage: GPUBufferUsage.STORAGE,
    uniform: GPUBufferUsage.UNIFORM,
  },
};
export default class AuroraBuffer {
  private static createdBuffers: Buffers = new Map();
  public static createDynamicBuffer(settings: DynamicBufferOptions) {
    const buffer = Aurora.device.createBuffer({
      label: settings.label ?? "generic vertex buffer",
      size: settings.typedArr.byteLength,
      usage: USAGE_MAP.dynamic[settings.bufferType],
    });
    settings.storeInMap && this.createdBuffers.set(settings.label, buffer);
    return buffer;
  }
  public static createMapedBuffer(settings: MapedBufferOptions) {
    const buffer = Aurora.device.createBuffer({
      label: settings.label ?? "generic vertex buffer",
      size:
        TYPED_MAP[settings.dataType].BYTES_PER_ELEMENT * settings.data.length,
      usage: USAGE_MAP.maped[settings.bufferType],
      mappedAtCreation: true,
    });
    new TYPED_MAP[settings.dataType](buffer.getMappedRange()).set(
      settings.data
    );
    buffer.unmap();
    settings.storeInMap && this.createdBuffers.set(settings.label, buffer);
    return buffer;
  }
  public static getBuffer(bufferName: string) {
    if (this.createdBuffers.has(bufferName))
      return this.createdBuffers.get(bufferName);
    else throw new Error(`there is no buffer named ${bufferName}`);
  }
}
