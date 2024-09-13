@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var inputTex : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<bgra8unorm, write>;
@group(0) @binding(3) var<uniform> flipAndDim : vec2u;

var<workgroup> tile : array<array<vec4<f32>, 128>, 4>;
@compute @workgroup_size(32, 1, 1)
fn computeMain(
  @builtin(workgroup_id) WorkGroupID : vec3<u32>,
  @builtin(local_invocation_id) LocalInvocationID : vec3<u32>
) {
  let filterDim = flipAndDim.y;
  let filterOffset = (i32(filterDim) - 1) / 2;
var blockDim: u32 = 128 - (filterDim - 1);
  let dims = vec2<i32>(textureDimensions(inputTex, 0));
  let baseIndex = vec2<i32>(WorkGroupID.xy * vec2(blockDim, 4) +
                            LocalInvocationID.xy * vec2(4, 1))
                  - vec2(filterOffset, 0);

  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      var loadIndex = baseIndex + vec2(c, r);
      if (flipAndDim.x != 0u) {
        loadIndex = loadIndex.yx;
      }

      tile[r][4 * LocalInvocationID.x + u32(c)] = textureSampleLevel(
        inputTex,
        samp,
        (vec2<f32>(loadIndex) + vec2<f32>(0.25, 0.25)) / vec2<f32>(dims),
        0.0
      ).rgba;
    }
  }

  workgroupBarrier();

  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      var writeIndex = baseIndex + vec2(c, r);
      if (flipAndDim.x != 0) {
        writeIndex = writeIndex.yx;
      }

      let center = i32(4 * LocalInvocationID.x) + c;
      if (center >= filterOffset &&
          center < 128 - filterOffset &&
          all(writeIndex < dims)) {
        var acc = vec3(0.0, 0.0, 0.0);
        for (var f = 0; f < i32(filterDim); f++) {
          var i = center + f - filterOffset;
          acc = acc + (1.0 / f32(filterDim)) * tile[r][i].rgb;
        }
        textureStore(outputTex, writeIndex, vec4(acc, 1));
      }
    }
  }

}
