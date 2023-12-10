@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var textureOffscreen: texture_2d<f32>;
@group(0) @binding(2) var textureBloom: texture_2d<f32>;
@group(0) @binding(3) var textureLight: texture_2d<f32>;
@group(0) @binding(4) var textureOffscreenFloat: texture_2d<f32>;
@group(1) @binding(0) var<uniform> compositeData: vec2u;

struct VertexInput {
  @builtin(vertex_index) vi: u32,
  @builtin(instance_index) index: u32,



};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1)  coords: vec2f,
  @location(2) @interpolate(flat) textureIndex: u32,
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
out.textureIndex = props.index;
return out;
};
@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
var out:vec4f;
var dark: f32 = 0.1;
let baseTextureFloat = textureSample(textureOffscreenFloat,textureSampOne,props.coords);
let baseTexture = textureSample(textureOffscreen,textureSampOne,props.coords);
let bloomData = textureSample(textureBloom,textureSampOne,props.coords);
let lightData = textureSample(textureLight,textureSampOne,props.coords);
var finalBloom: vec4f;
if(any(baseTextureFloat.rgb > vec3f(1))){
    finalBloom = vec4(baseTextureFloat.rgb-2,baseTextureFloat.a) + bloomData ;
}
else{
    finalBloom = baseTextureFloat + bloomData;
}
//TODO: dodac mozliwosc przebrutalizowania swiatla 
// out = (baseTexture * lightData) + lightData/2; <- switlo +/2 tylko dla faktycznego oswietlenia a nie calej sceny
return (baseTexture + bloomData) * lightData;
}





