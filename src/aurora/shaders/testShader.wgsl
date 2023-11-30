@group(0) @binding(0) var textureSampOne: sampler;
@group(0) @binding(1) var texture2DOne: texture_2d<f32>;
struct VertexInput {
  @builtin(vertex_index) vi: u32,

};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(1)  vi: vec2f,

  


};
@vertex
fn vertexMain(props:VertexInput) -> VertexOutput{
var out:VertexOutput;
switch(props.vi){
    case 0: {
        out.vi = vec2f(0,1);
        out.pos = vec4f(-1,-1,0,1);}
    case 1: {
        out.vi = vec2f(1,1);
        out.pos = vec4f(1,-1,0,1);}
    case 2: {
        out.vi = vec2f(0,0);
        out.pos = vec4f(-1,1,0,1);}
    case 3: {
        out.vi = vec2f(0,0);
        out.pos = vec4f(-1,1,0,1);}
    case 4: {
        out.vi = vec2f(1,1);
        out.pos = vec4f(1,-1,0,1);}
    case 5: {
        out.vi = vec2f(1,0);
        out.pos = vec4f(1,1,0,1);}
    default: {
        out.vi = vec2f(0,1);
        out.pos = vec4f(1,0,0,1);}
}
return out;
};
@fragment
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
var textures = textureSample(texture2DOne,textureSampOne,props.vi);
return textures;
}



