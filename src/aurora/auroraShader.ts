import Aurora from "./auroraCore";

export default class AuroraShader {
  private static shaders: Map<string, GPUShaderModule> = new Map();

  public static addShader(shaderName: string, shaderCode: string) {
    this.shaders.set(
      shaderName,
      Aurora.device.createShaderModule({
        label: shaderName,
        code: shaderCode,
      })
    );
  }
  public static getSader(shaderName: string) {
    if (!this.shaders.has(shaderName))
      throw new Error(`no render pipeline with that name: ${shaderName}`);
    return this.shaders.get(shaderName)!;
  }
}
