@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var texture2DOne: texture_2d<f32>;
@group(1) @binding(0) var<uniform> effectType: vec2f;

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
switch(props.vi){
    case 0: {
        out.coords = vec2f(0,1);
        out.pos = vec4f(-1,-1,0,1);}
    case 1: {
        out.coords = vec2f(1,1);
        out.pos = vec4f(1,-1,0,1);}
    case 2: {
        out.coords = vec2f(0,0);
        out.pos = vec4f(-1,1,0,1);}
    case 3: {
        out.coords = vec2f(0,0);
        out.pos = vec4f(-1,1,0,1);}
    case 4: {
        out.coords = vec2f(1,1);
        out.pos = vec4f(1,-1,0,1);}
    case 5: {
        out.coords = vec2f(1,0);
        out.pos = vec4f(1,1,0,1);}
    default: {
        out.coords = vec2f(0,1);
        out.pos = vec4f(1,0,0,1);}
}
return out;
};
@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
let intensity = 1.0;
var output:vec4f;
if(u32(effectType.x) == 1){output = grayscale(props.coords,effectType.y);}
else if(u32(effectType.x) == 2){output = sepia(props.coords,effectType.y);}
else if(u32(effectType.x) == 3){output = invert(props.coords,effectType.y);}
else if(u32(effectType.x) == 4){output = chroma(props.coords,effectType.y);}
else if(u32(effectType.x) == 5){output = vignette(props.coords,effectType.y);}
else {output = textureSample(texture2DOne,textureSampOne,props.coords);}
return output;
}
fn sepia(coords:vec2f,intensity:f32) -> vec4f{
let textures = textureSample(texture2DOne,textureSampOne,coords);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let sepiaConvert = vec4f(y+ 0.191, y-0.054, y-0.221, textures.a);
return mix(textures, sepiaConvert, intensity);
}
fn grayscale(coords:vec2f,intensity:f32) -> vec4f{
var textures = textureSample(texture2DOne,textureSampOne,coords);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let grayscaleColor = vec4f(y, y, y, textures.a); 
    return mix(textures, grayscaleColor, intensity);
}
fn invert(coords:vec2f,intensity:f32) -> vec4f {
    var textures = textureSample(texture2DOne,textureSampOne,coords);
    let invertedColor: vec3f = vec3f(1.0, 1.0, 1.0) - textures.rgb;
    let finalColor = vec4f(invertedColor,1);
     return mix(textures, finalColor, intensity);
}
fn chroma(coords:vec2f,intensity:f32) -> vec4f{
     let red_offset: vec2f = vec2f(0.005 * intensity, 0.0);
  let green_offset: vec2f = vec2f(0.0, 0.0);
  let blue_offset: vec2f = vec2f(-0.005 * intensity, 0.0);
    var textures = textureSample(texture2DOne,textureSampOne,coords);
  let color_r: vec4<f32> = textureSample(texture2DOne, textureSampOne, coords + red_offset);
  let color_g: vec4<f32> = textureSample(texture2DOne, textureSampOne, coords + green_offset);
  let color_b: vec4<f32> = textureSample(texture2DOne, textureSampOne, coords + blue_offset);
  return vec4<f32>(color_r.r, color_g.g, color_b.b, textures.a);
}

fn vignette(coords:vec2f,intensity:f32) -> vec4f {
  let dist: f32 = length(coords - vec2f(0.5, 0.5));
  let radius: f32 = 0.75; // Promień vignette
  let softness: f32 = 0.45; // Miękkość krawędzi
  let vignette_color: vec3<f32> = vec3<f32>(0.2, 0.0, 0.2);
  let vignette: f32 = smoothstep(radius, radius - softness, dist) * intensity;
  var color: vec4<f32> = textureSample(texture2DOne, textureSampOne, coords);
  return vec4f(mix(color.rgb * vignette, vignette_color, 1.0 - vignette) * intensity,color.a);
}



