@group(0) @binding(0) var universalSampler: sampler;
@group(0) @binding(1) var userTextures: texture_2d_array<f32>;
@group(1) @binding(0) var textSampler: sampler;
@group(1) @binding(1) var textTextures: texture_2d_array<f32>;
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
let data = getVertexData(props.vi,props.pos,props.size,props.crop);
 var out: VertexOutput;
 out.pos = data.position;
 out.textureCoord = data.textureCoords;
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
  return getGlyph(convertedColor,props.bloom,props.textureCoord,i32(props.textureIndex));
}
}

fn convertColor(color: vec4u) -> vec4f {
  return vec4f(color)/255;
}
fn getVertexData(index: u32,pos:vec2f,size:vec2f,crop:vec4f) -> GetVertexData{
if(index == 0){
  //x y z w
  return GetVertexData(vec4f(pos.x - size.x,pos.y + size.y,0,1),vec2f(crop.x,crop.y)); // 01
}
else if(index == 1){
  return GetVertexData(vec4f(pos.x + size.x,pos.y + size.y,0,1),vec2f(crop.z,crop.y)); //1 1
}
else if(index == 2){
  return GetVertexData(vec4f(pos.x - size.x,pos.y - size.y,0,1),vec2f(crop.x,crop.w)); // 00
}
else if(index == 3){
  return GetVertexData(vec4f(pos.x + size.x,pos.y - size.y,0,1),vec2f(crop.z,crop.w)); // 1 0
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
fn getGlyph(color:vec4f,bloom:u32,textureCoords:vec2f,textureIndex:i32) -> FragmenOut{
let glyph = textureSampleLevel(textTextures,textSampler,textureCoords,textureIndex,0);
var out:FragmenOut;
let finalColor = glyph * color;
out.one = finalColor;
  if(bloom == 0){
    out.two = finalColor;
  }
  else{
    out.two = vec4f(finalColor.rgb+2,finalColor.a);
  }
    return out;

}


