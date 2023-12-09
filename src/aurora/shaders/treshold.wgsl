@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var texture2DOne: texture_2d<f32>;

struct VertexInput {
  @builtin(vertex_index) vi: u32,
};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1)  coords: vec2f,
  
};
@vertex
fn vertexMain(props:VertexInput) -> VertexOutput{
var out:VertexOutput;
  var arr: array<vec4f,6>;
  arr[0] = vec4f(-1,-1,0,1);
  arr[1] = vec4f(1,-1,1,1);
  arr[2] = vec4f(-1,1,0,0);
  arr[3] = vec4f(-1,1,0,0);
  arr[4] = vec4f(1,-1,1,1);
  arr[5] = vec4f(1,1,1,0);
out.pos = vec4f(arr[props.vi].xy,0,1);
out.coords = vec2f(arr[props.vi].zw);
return out;
};

@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
var offscreen = textureSample(texture2DOne,textureSampOne,props.coords);
var output:vec4f;
if(any(offscreen.rgb > vec3(1))){
output = vec4f(offscreen.rgb - 2,offscreen.a);
}
else{
  output = vec4f(0,0,0,0);
}
return output;
}
