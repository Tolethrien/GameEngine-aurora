@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var textureOffscreen: texture_2d<f32>;
@group(0) @binding(2) var textureBloom: texture_2d<f32>;
@group(0) @binding(3) var textureLight: texture_2d<f32>;
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
let baseTexture = textureSample(textureOffscreen,textureSampOne,props.coords);
//TODO: dodac mozliwosc przebrutalizowania swiatla 
// out = (baseTexture * lightData) + lightData/2; <- switlo +/2 tylko dla faktycznego oswietlenia a nie calej sceny
return (baseTexture + getBloom(props.coords)) * getLights(props.coords);
}

fn getLights(coords: vec2f) -> vec4f{
    if(compositeData.x == 1){
        return textureSampleLevel(textureLight,textureSampOne,coords,0);
    }
    else{
        return vec4f(1);
    }
}

fn getBloom(coords: vec2f) -> vec4f{
if(compositeData.y == 1){
    var rgb =textureSampleLevel(textureBloom,textureSampOne,coords,0).rgb;
    return  vec4f(rgb,0);
}
else{
    return vec4f(0);
}

}





