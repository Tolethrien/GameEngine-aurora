@group(0) @binding(0) var universalSampler: sampler;
@group(0) @binding(1) var guiTextures: texture_2d_array<f32>;
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
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1) @interpolate(flat) color: vec4u,
  @location(2) textureCoords: vec2f,
  @location(3) @interpolate(flat) textureIndex: u32,
  @location(4) @interpolate(flat) isTexture: u32,
  @location(5) @interpolate(flat) isGlyph: u32,
};


@vertex
fn vertexMain(props:VertexInput) -> VertexOutput {
  var out: VertexOutput;
  if(props.isGlyph == 1){
  out.pos = getVertexTextPosition(props.vi,props.pos,props.size);
  out.pos.y = -out.pos.y;
  }
  else{
  out.pos = getVertexPosition(props.vi,props.pos,props.size);
  }
  out.textureCoords = getTextureCoords(props.vi,props.crop);
  out.color = props.color;
  out.textureIndex = props.textureIndex;
  out.isTexture = props.isTexture;
  out.isGlyph = props.isGlyph;
  return out;  
};

@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
  var convertedColor = convertColor(props.color);
  if(props.isGlyph == 1){
      let distance = textureSampleLevel(textTextures, textSampler, props.textureCoords,props.textureIndex,0).a;
      let fontSize = f32(props.isTexture);
      //0.4-0.1 kontroluje rozmycie w zaleznosci od wielkosci fontu
      var width = mix(0.4, 0.1, clamp(fontSize, 0, 40) / 40.0);
      let alpha = convertedColor.a * smoothstep(0.5 - width, 0.5 + width, distance);
        return vec4f(convertedColor.rgb, alpha);
    }
  else{
    if(props.isTexture == 1){
     return textureSampleLevel(guiTextures,universalSampler,props.textureCoords,props.textureIndex,0) * convertedColor;
    }
    else{
    return convertedColor;
    }
  }
}
fn convertColor(color: vec4u) -> vec4f {
  return vec4f(color)/255;
}
fn percentToScreenSpace(pos: vec2f) -> vec4f {
  let out = vec2f(2.0 * (pos.x / 100.0) - 1.0, 2.0 * ((100.0 - pos.y) / 100.0) - 1.0);
  return vec4f(out, 0, 1);
}
fn getVertexPosition(index: u32, pos: vec2f, size: vec2f) -> vec4f {
  switch(index) {
    case 0 { return percentToScreenSpace(vec2f(pos.x,pos.y)); }
    case 1 { return percentToScreenSpace(vec2f(pos.x + size.x, pos.y)); }
    case 2 { return percentToScreenSpace(vec2f(pos.x, pos.y + size.y)); }
    case 3 { return percentToScreenSpace(vec2f(pos.x+size.x, pos.y+size.y)); }
    default { return vec4f(0, 0, 0, 0); }
  }
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





