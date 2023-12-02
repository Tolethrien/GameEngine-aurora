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
else {output = textureSample(texture2DOne,textureSampOne,props.coords);}
return output;
// return vec4f(effectType.x,0,0,1);
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


