@group(0) @binding(0) var<uniform> effectType: vec2f;
@group(0) @binding(1) var textureSampOne: sampler;
@group(1) @binding(0) var compositionTexture: texture_2d<f32>;

struct VertexInput {
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1)  coords: vec2f,
  
};

@vertex
fn vertexMain(props: VertexInput) -> VertexOutput {
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
}

@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
var output:vec4f;
  

    if(u32(effectType.x) == 1){output = grayscale(props.coords,effectType.y);}
    else if(u32(effectType.x) == 2){output = sepia(props.coords,effectType.y);}
    else if(u32(effectType.x) == 3){output = invert(props.coords,effectType.y);}
    else if(u32(effectType.x) == 4){output = chroma(props.coords,effectType.y);}
    else if(u32(effectType.x) == 5){output = vignette(props.coords,effectType.y);}
    else if(u32(effectType.x) == 6){output = noice(props.coords,effectType.y);}
    else {output = textureSampleLevel(compositionTexture,textureSampOne,props.coords,0);}
  
return output;
}
fn sepia(coords:vec2f,intensity:f32) -> vec4f{
let textures = textureSampleLevel(compositionTexture,textureSampOne,coords,0);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let sepiaConvert = vec4f(y+ 0.191, y-0.054, y-0.221, textures.a);
return mix(textures, sepiaConvert, intensity);
}
fn grayscale(coords:vec2f,intensity:f32) -> vec4f{
var textures = textureSampleLevel(compositionTexture,textureSampOne,coords,0);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let grayscaleColor = vec4f(y, y, y, textures.a); 
    return mix(textures, grayscaleColor, intensity);
}
fn invert(coords:vec2f,intensity:f32) -> vec4f {
    var textures = textureSampleLevel(compositionTexture,textureSampOne,coords,0);
    let invertedColor: vec3f = vec3f(1.0, 1.0, 1.0) - textures.rgb;
    let finalColor = vec4f(invertedColor,1);
     return mix(textures, finalColor, intensity);
}
fn chroma(coords:vec2f,intensity:f32) -> vec4f{
     let red_offset: vec2f = vec2f(0.005 * intensity, 0.0);
  let green_offset: vec2f = vec2f(0.0, 0.0);
  let blue_offset: vec2f = vec2f(-0.005 * intensity, 0.0);
    var textures = textureSampleLevel(compositionTexture,textureSampOne,coords,0);
  let color_r: vec4<f32> = textureSampleLevel(compositionTexture, textureSampOne, coords + red_offset,0);
  let color_g: vec4<f32> = textureSampleLevel(compositionTexture, textureSampOne, coords + green_offset,0);
  let color_b: vec4<f32> = textureSampleLevel(compositionTexture, textureSampOne, coords + blue_offset,0);
  return vec4<f32>(color_r.r, color_g.g, color_b.b, textures.a);
}

fn vignette(coords:vec2f,intensity:f32) -> vec4f {
  let dist: f32 = length(coords - vec2f(0.5, 0.5));
  let radius: f32 = 0.75; // Promień vignette
  let softness: f32 = 0.45; // Miękkość krawędzi
  let vignette_color: vec3<f32> = vec3<f32>(0.2, 0.0, 0.2);
  let vignette: f32 = smoothstep(radius, radius - softness, dist) * intensity;
  var color: vec4<f32> = textureSampleLevel(compositionTexture, textureSampOne, coords,0);
  return vec4f(mix(color.rgb * vignette, vignette_color, 1.0 - vignette) * intensity,color.a);
}
fn noice(coords:vec2f,intensity:f32) -> vec4f {
  var color: vec4f = textureSampleLevel(compositionTexture, textureSampOne, coords,0);
  let noise: f32 = fract(sin(dot(coords, vec2f(12.9898, 78.233))) * 43758.5453);
  let noiseColor = vec3f(0.25);
  let out = vec4f(color.rgb + noise * noiseColor,color.a);
  return out;
}



