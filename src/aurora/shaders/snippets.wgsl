// tworzenie overlinu tekstury na bazie alphy otoczenia
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
    var size = 0.008;
    var textures= textureSample(texture2DOne,textureSampOne,props.textureCoord,i32(props.textureIndex));
    let right_neighbor_color = textureSample(texture2DOne,textureSampOne, props.textureCoord - vec2<f32>(size, 0),i32(props.textureIndex));
    let left_neighbor_color = textureSample(texture2DOne,textureSampOne, props.textureCoord + vec2<f32>(size, 0),i32(props.textureIndex));
    let top_neighbor_color = textureSample(texture2DOne,textureSampOne, props.textureCoord - vec2<f32>(0, size),i32(props.textureIndex));
    let bottom_neighbor_color = textureSample(texture2DOne,textureSampOne, props.textureCoord + vec2<f32>(0, size),i32(props.textureIndex));
        if(textures.w == 0){
            return vec4f(0,0,0,0);
        }
        else if(right_neighbor_color.w == 0 || left_neighbor_color.w == 0 || top_neighbor_color.w == 0 || bottom_neighbor_color.w == 0){
            return vec4f(0,0,props.textureCoord.y,1);
        }
        else{
            return vec4f(props.textureCoord.y,props.textureCoord.y,0,1);
        }
}
// border quada
fn fragmentMain(props:VertexOutput) -> @location(0) vec4f{
  var convertedColor = convertColor(props.color);
  var borderColor = vec4f(1,1,0,1);
  var borderThick = 0.05;
if(props.textureCoord.x > borderThick && props.textureCoord.x < 1 - borderThick && props.textureCoord.y > borderThick && props.textureCoord.y < 1 - borderThick ){
  return vec4f(0,0,0,0);
  } else {return convertedColor;}
}
// gradient na osi Y
fn fragmentMain(props: VertexOutput) -> @location(0) vec4f {
    var gradient = vec4f(0, props.textureCoord.y, 0, 1);
    if(props.textureCoord.y > 0.5){
    return gradient;
    }
    else {return vec4f(0,0,0,1);}
}