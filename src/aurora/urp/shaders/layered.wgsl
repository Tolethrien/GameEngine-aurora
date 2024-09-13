@group(0) @binding(0) var<uniform> effectType: vec2f;
@group(0) @binding(1) var textureSampOne: sampler;
@group(1) @binding(0) var textureNormal: texture_2d<f32>;
@group(1) @binding(1) var textureSaturated: texture_2d<f32>;
@group(1) @binding(2) var textureBlurTwo: texture_2d<f32>;
@group(1) @binding(3) var textureLights: texture_2d<f32>;
@group(1) @binding(4) var textureComposition: texture_2d<f32>;
@group(1) @binding(5) var guiTexture: texture_2d<f32>;

struct VertexInput {
  @builtin(vertex_index) vi: u32,
  @builtin(instance_index) instance: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1)  coords: vec2f,
  @location(2)  @interpolate(flat) instance: u32,
  
};

@vertex
fn vertexMain(props: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let instanceSize = vec2f(0.25, 0.5); 
  let gridSize = vec2u(4u, 2u); 
   let instancePos = vec2f(f32(props.instance % gridSize.x) * instanceSize.x * 2.0,
                          f32(props.instance / gridSize.x) * instanceSize.y * 2.0); // 
  var arr: array<vec2f,6>;
  arr[0] = vec2f(-instanceSize.x,-instanceSize.y);
  arr[1] = vec2f(instanceSize.x,-instanceSize.y);
  arr[2] = vec2f(-instanceSize.x,instanceSize.y);
  arr[3] = vec2f(-instanceSize.x,instanceSize.y);
  arr[4] = vec2f(instanceSize.x,-instanceSize.y);
  arr[5] = vec2f(instanceSize.x,instanceSize.y);
 // Koordynaty tekstury
  var texArr: array<vec2f, 6>;
  texArr[0] = vec2f(0.0, 1.0);
  texArr[1] = vec2f(1.0, 1.0);
  texArr[2] = vec2f(0.0, 0.0);
  texArr[3] = vec2f(0.0, 0.0);
  texArr[4] = vec2f(1.0, 1.0);
  texArr[5] = vec2f(1.0, 0.0);

  out.coords = texArr[props.vi];
  out.pos = vec4f(arr[props.vi] + instancePos - vec2f(0.75, 0.5), 0.0, 1.0);
out.instance = props.instance;
  return out;
}

@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
let intensity = 1.0;
var output:vec4f;
var arr: array<vec4f,8>;
  arr[0] = vec4f(1,0,0,1);
  arr[1] = vec4f(0,1,0,1);
  arr[2] = vec4f(0,0,1,1);
  arr[3] = vec4f(1,0,0,1);
  arr[4] = vec4f(0,1,0,1);
  arr[5] = vec4f(0,0,1,1);
  arr[6] = vec4f(1,0,0,1);
  arr[7] = vec4f(0,1,0,1);
let textureSize = vec2f(900.0, 600.0);
let quadSize = vec2f(225.0, 300.0);
let scale = textureSize / quadSize;
let coords = props.coords/scale;

var normal = textureSample(textureNormal,textureSampOne,coords);
var sat = textureSample(textureSaturated,textureSampOne,coords);
var gui = textureSample(guiTexture,textureSampOne,coords);
var blurTwo = textureSample(textureBlurTwo,textureSampOne,coords);
var compo = textureSample(textureComposition,textureSampOne,coords);
var light = textureSample(textureLights,textureSampOne,coords);
//normal map look
if(props.instance == 0){
  output = normal;
}
//normal map look
else if(props.instance == 1){
if(any(sat.rgb > vec3(1))){
  output = vec4f(sat.rgb,sat.a);
}
else{
  output = sat;
}
}
else if(props.instance == 2){
  output = blurTwo;
}
else if(props.instance == 3){
  output = light;
}
else if(props.instance == 4){
  output = compo;
}
else if(props.instance == 5){
    if(u32(effectType.x) == 1){output = grayscale(coords,effectType.y);}
else if(u32(effectType.x) == 2){output = sepia(coords,effectType.y);}
else if(u32(effectType.x) == 3){output = invert(coords,effectType.y);}
else if(u32(effectType.x) == 4){output = chroma(coords,effectType.y);}
else if(u32(effectType.x) == 5){output = vignette(coords,effectType.y);}
else {output = textureSampleLevel(textureComposition,textureSampOne,coords,0);}
}
else if(props.instance == 6){
  output = gui;
}
else if(props.instance == 7){
if(gui.a == 1){
    output = gui;
  }
  else{
    if(u32(effectType.x) == 1){output = grayscale(coords,effectType.y);}
    else if(u32(effectType.x) == 2){output = sepia(coords,effectType.y);}
    else if(u32(effectType.x) == 3){output = invert(coords,effectType.y);}
    else if(u32(effectType.x) == 4){output = chroma(coords,effectType.y);}
    else if(u32(effectType.x) == 5){output = vignette(coords,effectType.y);}
    else {output = textureSampleLevel(textureComposition,textureSampOne,coords,0);}
    if(gui.a != 0){
       output = mix(output, gui, gui.a);
    }
  }
}
else{
  output = vec4f(0,0,0,1);
}
return output;
}
fn sepia(coords:vec2f,intensity:f32) -> vec4f{
let textures = textureSampleLevel(textureComposition,textureSampOne,coords,0);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let sepiaConvert = vec4f(y+ 0.191, y-0.054, y-0.221, textures.a);
return mix(textures, sepiaConvert, intensity);
}
fn grayscale(coords:vec2f,intensity:f32) -> vec4f{
var textures = textureSampleLevel(textureComposition,textureSampOne,coords,0);
let y = dot(vec3f(0.299, 0.587, 0.114), textures.rgb);
let grayscaleColor = vec4f(y, y, y, textures.a); 
    return mix(textures, grayscaleColor, 1);
}
fn invert(coords:vec2f,intensity:f32) -> vec4f {
    var textures = textureSampleLevel(textureComposition,textureSampOne,coords,0);
    let invertedColor: vec3f = vec3f(1.0, 1.0, 1.0) - textures.rgb;
    let finalColor = vec4f(invertedColor,1);
     return mix(textures, finalColor, intensity);
}
fn chroma(coords:vec2f,intensity:f32) -> vec4f{
     let red_offset: vec2f = vec2f(0.005 * intensity, 0.0);
  let green_offset: vec2f = vec2f(0.0, 0.0);
  let blue_offset: vec2f = vec2f(-0.005 * intensity, 0.0);
    var textures = textureSampleLevel(textureComposition,textureSampOne,coords,0);
  let color_r: vec4<f32> = textureSampleLevel(textureComposition, textureSampOne, coords + red_offset,0);
  let color_g: vec4<f32> = textureSampleLevel(textureComposition, textureSampOne, coords + green_offset,0);
  let color_b: vec4<f32> = textureSampleLevel(textureComposition, textureSampOne, coords + blue_offset,0);
  return vec4<f32>(color_r.r, color_g.g, color_b.b, textures.a);
}

fn vignette(coords:vec2f,intensity:f32) -> vec4f {
  let dist: f32 = length(coords - vec2f(0.5, 0.5));
  let radius: f32 = 0.75; // Promień vignette
  let softness: f32 = 0.45; // Miękkość krawędzi
  let vignette_color: vec3<f32> = vec3<f32>(0.2, 0.0, 0.2);
  let vignette: f32 = smoothstep(radius, radius - softness, dist) * intensity;
  var color: vec4<f32> = textureSampleLevel(textureComposition, textureSampOne, coords,0);
  return vec4f(mix(color.rgb * vignette, vignette_color, 1.0 - vignette) * intensity,color.a);
}
// if(u32(effectType.x) == 1){output = grayscale(coords,effectType.y);}
// else if(u32(effectType.x) == 2){output = sepia(coords,effectType.y,textureNormal);}
// else if(u32(effectType.x) == 3){output = invert(coords,effectType.y);}
// else if(u32(effectType.x) == 4){output = chroma(coords,effectType.y);}
// else if(u32(effectType.x) == 5){output = vignette(coords,effectType.y);}
// else {output = textureSample(textureNormal,textureSampOne,coords);}


