@group(0) @binding(0) var universalSampler: sampler;
@group(0) @binding(1) var userTextures: texture_2d_array<f32>;
@group(1) @binding(0) var textSampler: sampler;
@group(1) @binding(1) var textTextures: texture_2d_array<f32>;
@group(2) @binding(0) var<uniform> camera: mat4x4f;
struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) size: vec2f,
  @location(2) crop: vec4f,
  @location(3) color: vec4u,
  @location(4) textureIndex: u32,
  @location(5) isTexture: u32,
  @location(6) isGlyph: u32,
  @location(7) bloom: u32,
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1) @interpolate(flat) color: vec4u,
  @location(2) textureCoord: vec2f,
  @location(3) @interpolate(flat) textureIndex: u32,
  @location(4) @interpolate(flat) isTexture: u32,
  @location(5) @interpolate(flat) isGlyph: u32,
  @location(6) @interpolate(flat) bloom: u32,
};
struct FragmenOut{
@location(0) one: vec4f,
@location(1) two: vec4f,
}
struct GetVertexData{
position: vec4f,
textureCoords: vec2f
};
@vertex
fn vertexMain(props:VertexInput) -> VertexOutput {
 var out: VertexOutput;
  if(props.isGlyph == 1){
  out.pos = getVertexTextPosition(props.vi,props.pos,props.size);
  // out.pos.y = -out.pos.y;
  out.textureCoord = getTextureCoords(props.vi,props.crop);
  }
  else{
let data = getVertexData(props.vi,props.pos,props.size,props.crop);
 out.textureCoord = data.textureCoords;
 out.pos = data.position;
  }
 out.pos = camera * out.pos;
 out.color = props.color;
 out.textureIndex = props.textureIndex;
 out.isTexture = props.isTexture;
 out.isGlyph = props.isGlyph;
 out.bloom = props.bloom;
  return out;  
};

@fragment
// zwykla tekstura i tint
fn fragmentMain(props:VertexOutput) -> FragmenOut{
var convertedColor = convertColor(props.color);
if(props.isGlyph == 0){
 if(props.isTexture == 0){
    return getShape(convertedColor,props.bloom);
  }
  else{
    return getTexture(convertedColor,props.bloom,props.textureCoord,i32(props.textureIndex));
  }
}
else{
  return getGlyph(convertedColor,props.bloom,props.textureCoord,props.isTexture,props.textureIndex);
}
}

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
fn getShape(color:vec4f,bloom:u32) -> FragmenOut{
var out:FragmenOut;
out.one = color;
  if(bloom == 0){
    out.two = color;
  }
  else{
    out.two = vec4f(color.rgb+2,color.a);
  }
    return out;
}

fn getTexture(color:vec4f,bloom:u32,textureCoords:vec2f,textureIndex:i32) -> FragmenOut{
let texture = textureSampleLevel(userTextures,universalSampler,textureCoords,textureIndex,0);
var out:FragmenOut;
let finalColor = texture * color;
out.one = finalColor;
  if(bloom == 0){
    out.two = finalColor;
  }
  else{
    out.two = vec4f(finalColor.rgb+2,finalColor.a);
  }
    return out;

}
fn getGlyph(color:vec4f,bloom:u32,textureCoords:vec2f,font:u32,textureIndex:u32) -> FragmenOut{
// let glyph = textureSampleLevel(textTextures,textSampler,textureCoords,textureIndex,0);
var out:FragmenOut;
// let finalColor = glyph * color;
// out.one = finalColor;
//   if(bloom == 0){
//     out.two = finalColor;
//   }
//   else{
//     out.two = vec4f(finalColor.rgb+2,finalColor.a);
//   }
//     return out;
let distance = textureSampleLevel(textTextures, textSampler, textureCoords,textureIndex,0).a;
      let fontSize = f32(font);
      //0.4-0.1 kontroluje rozmycie w zaleznosci od wielkosci fontu
      var width = mix(0.4, 0.1, clamp(fontSize, 0, 40) / 40.0);
      let alpha = color.a * smoothstep(0.5 - width, 0.5 + width, distance);
        // return vec4f(color.rgb, alpha);
out.one = vec4f(color.rgb, alpha);
out.two = vec4f(color.rgb+2, alpha);
return out;
}
fn getVertexTextPosition(index: u32, pos: vec2f, size: vec2f) -> vec4f {
// let pos = vec2f(pos.x - size.x / 2.0, pos.y - size.y / 2.0);
  switch(index) {
    case 0 { return vec4f(pos.x, pos.y, 0, 1); }
    case 1 { return vec4f(pos.x + size.x, pos.y, 0, 1); }
    case 2 { return vec4f(pos.x, pos.y + size.y, 0, 1); }
    case 3 { return vec4f(pos.x + size.x, pos.y + size.y, 0, 1); }
    default { return vec4f(0, 0, 0, 0); }
  }
}
fn getTextureCoords(index: u32, crop: vec4f) -> vec2f {
  switch(index) {
    case 0 { return vec2f(crop.x, crop.y); }
    case 1 { return vec2f(crop.z, crop.y); }
    case 2 { return vec2f(crop.x, crop.w); }
    case 3 { return vec2f(crop.z, crop.w); }
    default { return vec2f(0, 0); }
  }
}


