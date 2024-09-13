@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var texture2DOne: texture_2d_array<f32>;
@group(1) @binding(0) var<uniform> camera: mat4x4f;
struct VertexInput {
  @location(0) pos: vec2u,
  @location(1) size: vec2u,
  @location(2) tint: vec3u,
  @location(3) intensity: u32,
  @location(4) lightType: u32,
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1) @interpolate(flat) tint: vec3u,
  @location(2) textureCoord: vec2f,
  @location(3) @interpolate(flat) intensity: u32,
  @location(4) @interpolate(flat) lightType: u32,
};

struct GetVertexData{
position: vec4f,
textureCoords: vec2f
};

@vertex
fn vertexMain(props:VertexInput) -> VertexOutput {
let data = getVertexData(props.vi,vec2f(props.pos),vec2f(props.size));
 var out: VertexOutput;
 out.pos = camera * data.position;
 out.textureCoord = data.textureCoords;
 out.tint = props.tint;
 out.intensity = props.intensity;
 out.lightType = props.lightType;
  return out;  
};

@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
var convertedColor = convertColor(vec4u(props.tint,props.intensity));
var textures = textureSample(texture2DOne,textureSampOne,props.textureCoord,props.lightType);
return textures * convertedColor;
}

fn convertColor(color: vec4u) -> vec4f {
  return vec4f(color)/255;
}
fn getVertexData(index: u32,pos:vec2f,size:vec2f) -> GetVertexData{
if(index == 0){
  return GetVertexData(vec4f(pos.x - size.x,pos.y + size.y,0,1),vec2f(0,1)); // 01
}
else if(index == 1){
  return GetVertexData(vec4f(pos.x + size.x,pos.y + size.y,0,1),vec2f(1,1)); //1 1
}
else if(index == 2){
  return GetVertexData(vec4f(pos.x - size.x,pos.y - size.y,0,1),vec2f(0,0)); // 00
}
else if(index == 3){
  return GetVertexData(vec4f(pos.x + size.x,pos.y - size.y,0,1),vec2f(1,0)); // 1 0
}
else {return GetVertexData(vec4f(0,0,0,0),vec2f(0,0));}
}



