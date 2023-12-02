@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var texture2DOne: texture_2d_array<f32>;
@group(1) @binding(0) var<uniform> camera: mat4x4f;
struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) size: vec2f,
  @location(2) crop: vec4f,
  @location(3) color: vec4u,
  @location(4) textureIndex: u32,
  @location(5) colorOrTexture: u32,
  @builtin(instance_index) index: u32,
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1) @interpolate(flat) color: vec4u,
  @location(2) textureCoord: vec2f,
  @location(3) @interpolate(flat) textureIndex: u32,
  @location(4) @interpolate(flat) colorOrTexture: u32,
  


};
struct GetVertexData{
position: vec4f,
textureCoords: vec2f
};
@vertex
fn vertexMain(props:VertexInput) -> VertexOutput {
let data = getVertexData(props.vi,props.pos,props.size,props.crop);
 var out: VertexOutput;
 out.pos = camera * data.position;
 out.textureCoord = data.textureCoords;
 out.color = props.color;
 out.textureIndex = props.textureIndex;
 out.colorOrTexture = props.colorOrTexture;
  return out;  
};
struct FragmenOut{
@location(0) one: vec4f,
@location(1) two: vec4f
}
@fragment
// zwykla tekstura i tint
fn fragmentMain(props:VertexOutput) -> FragmenOut{
var convertedColor = convertColor(props.color);
var textures = textureSample(texture2DOne,textureSampOne,props.textureCoord,i32(props.textureIndex));

let color = mix(convertedColor,textures * convertedColor,f32(props.colorOrTexture));
var out:FragmenOut;
out.one = color;
out.two = color;
return out;
}
// debug border
// fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
//   var convertedColor = convertColor(props.color);
//   var borderColor = vec4f(1,1,0,1);
//   var borderThick = 0.05;
// // return color;
// if(props.textureCoord.x > borderThick && props.textureCoord.x < 1 - borderThick && props.textureCoord.y > borderThick && props.textureCoord.y < 1 - borderThick ){
//   return vec4f(0,0,0,0);
//   } else {return convertedColor;}
// }
//gradient do testowania xy coordow
// fn fragmentMain(props: VertexOutput) -> @location(0) vec4f {
//     var gradient = vec4f(0, props.textureCoord.y, 0, 1);
//     if(props.textureCoord.y > 0.5){
//     return gradient;
//     }
//     else {return vec4f(0,0,0,1);}
// }
fn convertColor(color: vec4u) -> vec4f {
  return vec4f(color)/255;
}
fn getVertexData(index: u32,pos:vec2f,size:vec2f,crop:vec4f) -> GetVertexData{
if(index == 0){
  return GetVertexData(vec4f(pos.x - size.x,pos.y + size.y,0,1),vec2f(crop.x,crop.w)); // 01
}
else if(index == 1){
  return GetVertexData(vec4f(pos.x + size.x,pos.y + size.y,0,1),vec2f(crop.z,crop.w)); //1 1
}
else if(index == 2){
  return GetVertexData(vec4f(pos.x - size.x,pos.y - size.y,0,1),vec2f(crop.x,crop.y)); // 00
}
else if(index == 3){
  return GetVertexData(vec4f(pos.x + size.x,pos.y - size.y,0,1),vec2f(crop.z,crop.y)); // 1 0
}
else {return GetVertexData(vec4f(0,0,0,0),vec2f(0,0));}
}


