import Aurora from "./auroraCore";
interface bindGroupTemplate {
  name: string;
  layout: GPUBindGroupLayoutDescriptor;
  data: { entries: Iterable<GPUBindGroupEntry>; label?: string };
}
type PipeList = Map<string, GPURenderPipeline | GPUComputePipeline>;
type BindGroup = Map<
  string,
  { bind: GPUBindGroup; layout: GPUBindGroupLayout }
>;
type PipeLay = Map<
  string,
  { layout: GPUBindGroupLayout[]; associateBinds: string[] }
>;
type VBGL = Map<string, string[]>;
type vertexBuffLay = Map<string, GPUVertexBufferLayout>;
type ColorAttachments =
  | "oversaturated"
  | "standard"
  | "storage-read-write"
  | "post-process"
  | "test-standard";
export default class AuroraPipeline {
  private static pipelineList: PipeList = new Map();
  private static bindGroups: BindGroup = new Map();
  private static pipelineLeyouts: PipeLay = new Map();
  private static vertexBuffersLeyouts: vertexBuffLay = new Map();
  private static vertexBuffersLeyoutGroups: VBGL = new Map();

  public static addBindGroup({
    name,
    layout,
    data,
  }: bindGroupTemplate): [GPUBindGroup, GPUBindGroupLayout] {
    const layoutOut = Aurora.device.createBindGroupLayout(layout);
    const entriesOut = Aurora.device.createBindGroup({
      entries: data.entries,
      layout: layoutOut,
      label: data.label,
    });
    this.bindGroups.set(name, { bind: entriesOut, layout: layoutOut });
    return [entriesOut, layoutOut];
  }
  public static getBindsFromLayout(layoutName: string) {
    const binds = this.pipelineLeyouts.get(layoutName)?.associateBinds;
    if (!binds)
      throw new Error(
        "AuroraBatcher: you trying to set bind layout that dont exist "
      );
    return binds.map((bind) => this.bindGroups.get(bind)!.bind);
  }
  public static createVertexBufferLayout(
    layoutName: string,
    layout: GPUVertexBufferLayout
  ) {
    this.vertexBuffersLeyouts.set(layoutName, layout);
    return layout;
  }
  public static createVertexBufferLayoutGroup(
    groupName: string,
    vblList: string[]
  ) {
    vblList.forEach((bufferName) => {
      if (!this.vertexBuffersLeyouts.has(bufferName)) throw new Error("");
    });
    this.vertexBuffersLeyoutGroups.set(groupName, vblList);
  }

  public static getVertexBufferLayoutGroup(groupName: string) {
    const group = this.vertexBuffersLeyoutGroups.get(groupName);
    if (!group)
      throw new Error(`no vertext buffer layout group with name ${groupName}`);
    return group.map((name) => this.vertexBuffersLeyouts.get(name)!);
  }
  public static createPipelineLayout(layoutName: string, bindGrous: string[]) {
    bindGrous.forEach((bind) => {
      if (!this.bindGroups.has(bind))
        throw new Error(`bind group with name ${bind} dont exist`);
    });
    const pipe = bindGrous.reduce(
      (acc, bind) => acc.concat(this.bindGroups.get(bind)!.layout),
      [] as GPUBindGroupLayout[]
    );
    this.pipelineLeyouts.set(layoutName, {
      layout: pipe,
      associateBinds: bindGrous,
    });
  }
  public static createRenderPipeline({
    pipelineName,
    buffers,
    pipelineLayout,
    shader,
    colorTargets,
  }: {
    pipelineName: string;
    pipelineLayout: GPUPipelineLayout;
    shader: GPUShaderModule;
    buffers: GPUVertexBufferLayout[];
    colorTargets?: GPUColorTargetState[];
  }) {
    this.pipelineList.set(
      pipelineName,
      Aurora.device.createRenderPipeline({
        label: pipelineName,
        layout: pipelineLayout,
        vertex: {
          module: shader,
          entryPoint: "vertexMain",
          buffers: buffers,
        },

        fragment: {
          module: shader,
          entryPoint: "fragmentMain",
          targets: colorTargets ?? [this.getColorTargetTemplate("standard")],
        },
      })
    );
  }
  public static getPipelineLayout(layoutName: string) {
    const layout = this.pipelineLeyouts.get(layoutName)?.layout;
    if (!layout)
      throw new Error(
        `No bind layout(render pipeline layout) with this name: ${layoutName} in Aurora Bind Group`
      );
    return Aurora.device.createPipelineLayout({
      bindGroupLayouts: layout,
      label: layoutName,
    });
  }
  public static createComputePipeline({
    pipelineName,
    pipelineLayout,
    shader,
  }: {
    pipelineName: string;
    pipelineLayout: GPUPipelineLayout;
    shader: GPUShaderModule;
  }) {
    this.pipelineList.set(
      pipelineName,
      Aurora.device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      })
    );
  }

  public static getPipeline<T extends GPURenderPipeline | GPUComputePipeline>(
    pipelineName: string
  ): T {
    const pipeline = this.pipelineList.get(pipelineName);
    if (pipeline instanceof GPURenderPipeline) {
      return pipeline as T;
    } else if (pipeline instanceof GPUComputePipeline) {
      return pipeline as T;
    } else {
      throw new Error(`no render pipeline with that name: ${pipelineName}`);
    }
  }
  public static getColorTargetTemplate(
    type: ColorAttachments
  ): GPUColorTargetState {
    switch (type) {
      case "standard":
        return {
          format: navigator.gpu.getPreferredCanvasFormat(),
          writeMask: GPUColorWrite.ALL,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one",
              operation: "add",
            },
          },
        };
      case "post-process":
        return {
          format: navigator.gpu.getPreferredCanvasFormat(),
          writeMask: GPUColorWrite.ALL,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        };
      case "test-standard":
        return {
          format: navigator.gpu.getPreferredCanvasFormat(),
          writeMask: GPUColorWrite.ALL,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        };
      case "storage-read-write":
        return {
          format: "r32uint",
        };
      case "oversaturated":
        return {
          format: "rgba16float",
          writeMask: GPUColorWrite.ALL,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        };
    }
  }
}
