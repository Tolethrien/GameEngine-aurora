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
// @compute @workgroup_size(16, 16, 1)
// fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
//     var texelCoord: vec2<u32> = id.xy; // Używamy typu u32 dla koordynatów tekstury
//     var color: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 1.0);
//     var totalWeight: f32 = 0.0;

//     // Pętla do obliczenia rozmycia Gaussa
//     for (var offset: i32 = -4; offset <= 4; offset++) {
//         let weight = gaussianWeight(offset, blurStrength);
//         // Konwersja i32 na u32 z zachowaniem warunku nieujemności
//         let sampleCoord = texelCoord + vec2<u32>(u32(max(0, offset)), u32(max(0, offset)));
//         let sampleColor = textureLoad(inputOutputTexture, sampleCoord);
//        let sampleColorF32 = vec4<f32>(f32(sampleColor.r), f32(sampleColor.g), f32(sampleColor.b), f32(sampleColor.a));
//         color += sampleColorF32 * weight;
//         totalWeight += weight;
//     }

//     // Normalizacja koloru
//     color /= totalWeight;
//     // let finalColor: vec4<u32> = vec4<u32>(u32(color.r * 255.0), u32(color.g * 255.0), u32(color.b * 255.0), u32(color.a * 255.0));
//     let finalColor: vec4<f32> = color * 255.0;
//     // Zapisanie wyniku do tekstury
//     textureStore(inputOutputTexture, texelCoord, finalColor);
// }